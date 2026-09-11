# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from datetime import datetime, timezone
import hashlib
import json
import re


MAX_U256 = 2**256 - 1
ADDRESS_RE = re.compile(r"^0x[0-9a-f]{40}$")
ID_RE = re.compile(r"^[a-z][a-z0-9_]{0,15}$")
NONCE_RE = re.compile(r"^[0-9a-f]{32}$")
LABELS = {"ADDRESSES", "PARTIAL", "NONRESPONSIVE", "UNKNOWN"}
TERMINAL_PHASES = {"DONE", "EXHAUSTED"}


def canonical(value) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def fail(code: str):
    raise gl.vm.UserError(code)


def byte_len(value: str) -> int:
    return len(value.encode("utf-8"))


def parse_json(raw: str, cap: int):
    if not isinstance(raw, str) or byte_len(raw) > cap:
        fail("BAD_JSON")
    raw = raw.replace("\r\n", "\n")

    def pairs(items):
        out = {}
        for key, value in items:
            if key in out:
                fail("BAD_JSON")
            out[key] = value
        return out

    try:
        value = json.loads(
            raw,
            object_pairs_hook=pairs,
            parse_float=lambda _: fail("BAD_JSON"),
            parse_constant=lambda _: fail("BAD_JSON"),
        )
    except gl.vm.UserError:
        raise
    except Exception:
        fail("BAD_JSON")
    return value


def exact_object(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        fail("BAD_SCHEMA")


def small_int(value, low: int, high: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < low or value > high:
        fail("BAD_SCHEMA")
    return value


def text(value, cap: int, empty: bool = False) -> str:
    if not isinstance(value, str) or (not empty and value == "") or byte_len(value) > cap:
        fail("BAD_SCHEMA")
    for char in value:
        if ord(char) < 32 and char not in "\n\t":
            fail("BAD_SCHEMA")
    return value


def uint(value) -> int:
    if isinstance(value, bool):
        fail("BAD_SCHEMA")
    number = int(value)
    if number < 0 or number > MAX_U256:
        fail("BAD_SCHEMA")
    return number


def decimal(value) -> str:
    number = uint(value)
    return str(number)


def address(value: Address) -> str:
    raw = value.as_bytes if hasattr(value, "as_bytes") else value
    result = "0x" + bytes(raw).hex()
    if not ADDRESS_RE.fullmatch(result):
        fail("BAD_ADDRESS")
    return result


def sha_args(values) -> str:
    return hashlib.sha256(canonical(values).encode("utf-8")).hexdigest()


def validate_base(value):
    exact_object(value, ("root_id", "nodes", "edges"))
    root = text(value["root_id"], 16)
    if not ID_RE.fullmatch(root):
        fail("BAD_SCHEMA")
    nodes = value["nodes"]
    edges = value["edges"]
    if not isinstance(nodes, list) or not 1 <= len(nodes) <= 12:
        fail("BAD_SCHEMA")
    if not isinstance(edges, list) or len(edges) > 24:
        fail("BAD_SCHEMA")
    ids = set()
    normalized_nodes = []
    types = {}
    for node in nodes:
        exact_object(node, ("id", "type", "text"))
        node_id = text(node["id"], 16)
        node_type = node["type"]
        if not ID_RE.fullmatch(node_id) or node_id in ids or node_type not in ("CLAIM", "OBJECTION"):
            fail("BAD_SCHEMA")
        ids.add(node_id)
        types[node_id] = node_type
        normalized_nodes.append({"id": node_id, "type": node_type, "text": text(node["text"], 384)})
    if root not in ids or types[root] != "CLAIM":
        fail("BAD_SCHEMA")
    seen_edges = set()
    normalized_edges = []
    for edge in edges:
        exact_object(edge, ("from", "to", "type"))
        source = edge["from"]
        target = edge["to"]
        kind = edge["type"]
        key = (source, target, kind)
        if source not in ids or target not in ids or source == target or key in seen_edges:
            fail("BAD_SCHEMA")
        if kind not in ("SUPPORTS", "ATTACKS"):
            fail("BAD_SCHEMA")
        seen_edges.add(key)
        normalized_edges.append({"from": source, "to": target, "type": kind})
    return {"root_id": root, "nodes": normalized_nodes, "edges": normalized_edges}


def validate_response(value, base):
    exact_object(value, ("replies",))
    replies = value["replies"]
    objections = {node["id"] for node in base["nodes"] if node["type"] == "OBJECTION"}
    if not isinstance(replies, list) or len(replies) > 12:
        fail("BAD_SCHEMA")
    targets = set()
    normalized = []
    for reply in replies:
        exact_object(reply, ("target", "text"))
        target = reply["target"]
        if target not in objections or target in targets:
            fail("BAD_SCHEMA")
        targets.add(target)
        normalized.append({"target": target, "text": text(reply["text"], 384)})
    return {"replies": normalized}


def validate_result(value, reply_count: int):
    exact_object(value, ("v", "labels"))
    if small_int(value["v"], 1, 1) != 1 or not isinstance(value["labels"], list):
        fail("MALFORMED_RESULT")
    if len(value["labels"]) != reply_count or any(label not in LABELS for label in value["labels"]):
        fail("MALFORMED_RESULT")
    return {"v": 1, "labels": list(value["labels"])}


def graph_analysis(base):
    adjacency = {node["id"]: [] for node in base["nodes"]}
    reverse = {node["id"]: [] for node in base["nodes"]}
    for edge in base["edges"]:
        adjacency[edge["from"]].append(edge["to"])
        reverse[edge["to"]].append(edge["from"])
    colors = {node_id: 0 for node_id in adjacency}

    def visit(node_id):
        colors[node_id] = 1
        for child in adjacency[node_id]:
            if colors[child] == 1 or (colors[child] == 0 and visit(child)):
                return True
        colors[node_id] = 2
        return False

    cyclic = any(colors[node_id] == 0 and visit(node_id) for node_id in adjacency)
    relevant = set()
    stack = [base["root_id"]]
    while stack:
        node_id = stack.pop()
        if node_id in relevant:
            continue
        relevant.add(node_id)
        stack.extend(reverse[node_id])
    objections = [node["id"] for node in base["nodes"] if node["type"] == "OBJECTION" and node["id"] in relevant]
    return cyclic, objections


class ArgumentDependencyClosureLedger(gl.Contract):
    case_count: u256
    cases: TreeMap[u256, str]
    nonce_index: TreeMap[str, u256]
    actor_index: TreeMap[str, str]
    child_index: TreeMap[u256, str]
    version_index: TreeMap[u256, u256]
    history: TreeMap[str, str]

    def __init__(self):
        self.case_count = u256(0)

    def _record(self, case_id: u256):
        uint(case_id)
        raw = self.cases.get(case_id, "")
        if raw == "":
            fail("NOT_FOUND")
        return json.loads(raw)

    def _commit(self, record, method: str, caller: str, args):
        revision = int(record["revision"]) + 1
        if revision > 32:
            fail("CAPACITY")
        record["revision"] = str(revision)
        record["last_operation"] = {"method": method, "caller": caller, "args_hash": sha_args(args)}
        encoded = canonical(record)
        if byte_len(encoded) > 24576:
            fail("CAPACITY")
        case_id = u256(int(record["id"]))
        self.cases[case_id] = encoded
        self.version_index[case_id] = u256(revision)
        self.history[record["id"] + ":" + str(revision)] = encoded

    def _expect(self, record, caller: str, role: str, phase, expected_revision: u256):
        if int(record["revision"]) != uint(expected_revision):
            fail("STALE_REVISION")
        if record[role] != caller:
            fail("FORBIDDEN")
        if record["phase"] not in phase:
            fail("BAD_PHASE")

    def _actor_add(self, actor: str, case_id: int):
        ids = json.loads(self.actor_index.get(actor, "[]"))
        if str(case_id) not in ids:
            if len(ids) >= 32:
                fail("CAPACITY")
            ids.append(str(case_id))
            ids.sort(key=int)
            self.actor_index[actor] = canonical(ids)

    @gl.public.write
    def create_graph(self, nonce: str, responder: Address, base_json: str, parent: u256) -> u256:
        creator = address(gl.message.sender_address)
        secondary = address(responder)
        nonce = text(nonce, 32)
        if not NONCE_RE.fullmatch(nonce) or creator == secondary or secondary == "0x" + "0" * 40:
            fail("BAD_SCHEMA")
        base = validate_base(parse_json(base_json, 8192))
        original_args = [nonce, secondary, base, decimal(parent)]
        create_hash = sha_args(original_args)
        nonce_key = creator + ":" + nonce
        existing = int(self.nonce_index.get(nonce_key, u256(0)))
        if existing:
            record = self._record(u256(existing))
            if record["create_hash"] != create_hash:
                fail("NONCE_CONFLICT")
            return u256(existing)
        if int(self.case_count) >= 32:
            fail("CAPACITY")
        parent_id = uint(parent)
        if parent_id:
            parent_record = self._record(parent)
            if parent_record["phase"] not in TERMINAL_PHASES or parent_record["primary"] != creator or parent_record["secondary"] != secondary:
                fail("BAD_PARENT")
            children = json.loads(self.child_index.get(parent, "[]"))
            if len(children) >= 32:
                fail("CAPACITY")
        else:
            children = []
        case_id = int(self.case_count) + 1
        for actor in {creator, secondary}:
            if len(json.loads(self.actor_index.get(actor, "[]"))) >= 32:
                fail("CAPACITY")
        record = {
            "v": 1, "id": str(case_id), "primary": creator, "secondary": secondary,
            "phase": "BASE_DRAFT", "revision": "1", "parent": str(parent_id),
            "create_hash": create_hash, "base": base, "response": {},
            "base_locked": False, "response_locked": False, "accepted_attempts": 0,
            "last_accepted_at": "0", "outcome": "", "result": {}, "domain": {},
            "last_operation": {"method": "create_graph", "caller": creator, "args_hash": create_hash},
        }
        encoded = canonical(record)
        if byte_len(encoded) > 24576:
            fail("CAPACITY")
        self.case_count = u256(case_id)
        self.cases[u256(case_id)] = encoded
        self.nonce_index[nonce_key] = u256(case_id)
        self.version_index[u256(case_id)] = u256(1)
        self.history[str(case_id) + ":1"] = encoded
        self._actor_add(creator, case_id)
        self._actor_add(secondary, case_id)
        if parent_id:
            children.append(str(case_id))
            self.child_index[parent] = canonical(children)
        return u256(case_id)

    @gl.public.write
    def replace_graph(self, id: u256, base_json: str, expected_revision: u256) -> None:
        record = self._record(id)
        caller = address(gl.message.sender_address)
        self._expect(record, caller, "primary", ("BASE_DRAFT",), expected_revision)
        if int(record["revision"]) > 25:
            fail("CAPACITY")
        base = validate_base(parse_json(base_json, 8192))
        record["base"] = base
        self._commit(record, "replace_graph", caller, [decimal(id), base, decimal(expected_revision)])

    @gl.public.write
    def lock_graph(self, id: u256, expected_revision: u256) -> None:
        record = self._record(id)
        caller = address(gl.message.sender_address)
        self._expect(record, caller, "primary", ("BASE_DRAFT",), expected_revision)
        validate_base(record["base"])
        record["base_locked"] = True
        record["phase"] = "BASE_LOCKED"
        self._commit(record, "lock_graph", caller, [decimal(id), decimal(expected_revision)])

    @gl.public.write
    def put_replies(self, id: u256, response_json: str, expected_revision: u256) -> None:
        record = self._record(id)
        caller = address(gl.message.sender_address)
        self._expect(record, caller, "secondary", ("BASE_LOCKED", "RESPONSE_DRAFT"), expected_revision)
        if int(record["revision"]) > 27:
            fail("CAPACITY")
        response = validate_response(parse_json(response_json, 6144), record["base"])
        record["response"] = response
        record["response_locked"] = False
        record["phase"] = "RESPONSE_DRAFT"
        self._commit(record, "put_replies", caller, [decimal(id), response, decimal(expected_revision)])

    @gl.public.write
    def freeze_replies(self, id: u256, expected_revision: u256) -> None:
        record = self._record(id)
        caller = address(gl.message.sender_address)
        self._expect(record, caller, "secondary", ("RESPONSE_DRAFT",), expected_revision)
        validate_response(record["response"], record["base"])
        record["response_locked"] = True
        record["phase"] = "FROZEN"
        self._commit(record, "freeze_replies", caller, [decimal(id), decimal(expected_revision)])

    def _evaluate(self, record, method: str, caller: str, expected_revision: u256):
        base = validate_base(record["base"])
        response = validate_response(record["response"], base)
        cyclic, relevant_objections = graph_analysis(base)
        replies = response["replies"]
        if cyclic:
            result = {"v": 1, "labels": []}
            outcome = "GRAPH_INVALID"
        else:
            if replies:
                frozen = {"base": base, "response": response}
                task = (
                    "Classify each reply in exact order. ADDRESSES means directly engaging the target "
                    "objection's asserted reason, not necessarily agreement. PARTIAL engages only part; "
                    "NONRESPONSIVE does not engage it; ambiguity is UNKNOWN. Return only the schema."
                )
                schema = canonical({"v": 1, "labels": ["ADDRESSES|PARTIAL|NONRESPONSIVE|UNKNOWN"] * len(replies)})
                prompt = task + "\nSCHEMA\n" + schema + "\nBEGIN_UNTRUSTED_JSON\n" + canonical(frozen) + "\nEND_UNTRUSTED_JSON"

                def leader_fn():
                    raw = gl.nondet.exec_prompt(prompt, response_format="json")
                    if isinstance(raw, str):
                        if byte_len(raw) > 4096:
                            fail("MALFORMED_RESULT")
                        raw = parse_json(raw, 4096)
                    elif not isinstance(raw, dict) or byte_len(canonical(raw)) > 4096:
                        fail("MALFORMED_RESULT")
                    return validate_result(raw, len(replies))

                def validator_fn(proposed):
                    if not isinstance(proposed, gl.vm.Return):
                        return False
                    try:
                        theirs = validate_result(proposed.calldata, len(replies))
                        mine = leader_fn()
                        return canonical(theirs) == canonical(mine)
                    except Exception:
                        return False

                result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
                result = validate_result(result, len(replies))
            else:
                result = {"v": 1, "labels": []}
            by_target = {reply["target"]: result["labels"][index] for index, reply in enumerate(replies)}
            if any(by_target.get(target) == "UNKNOWN" for target in relevant_objections):
                outcome = "UNRESOLVED"
            elif any(by_target.get(target) != "ADDRESSES" for target in relevant_objections):
                outcome = "OPEN_OBJECTIONS"
            else:
                outcome = "CLOSED_FOR_DECISION"
        record["accepted_attempts"] += 1
        record["last_accepted_at"] = str(int(datetime.now(timezone.utc).timestamp()))
        record["result"] = result
        record["outcome"] = outcome
        record["phase"] = "UNRESOLVED" if outcome == "UNRESOLVED" else "DONE"
        if outcome == "UNRESOLVED" and record["accepted_attempts"] == 3:
            record["phase"] = "EXHAUSTED"
        self._commit(record, method, caller, [record["id"], decimal(expected_revision)])

    @gl.public.write
    def evaluate_closure(self, id: u256, expected_revision: u256) -> None:
        record = self._record(id)
        caller = address(gl.message.sender_address)
        if int(record["revision"]) != uint(expected_revision):
            fail("STALE_REVISION")
        if record["phase"] != "FROZEN" or record["accepted_attempts"] != 0:
            fail("BAD_PHASE")
        self._evaluate(record, "evaluate_closure", caller, expected_revision)

    @gl.public.write
    def retry_closure(self, id: u256, expected_revision: u256) -> None:
        record = self._record(id)
        caller = address(gl.message.sender_address)
        if int(record["revision"]) != uint(expected_revision):
            fail("STALE_REVISION")
        now = int(datetime.now(timezone.utc).timestamp())
        if record["phase"] != "UNRESOLVED" or record["accepted_attempts"] >= 3:
            fail("BAD_PHASE")
        if now < int(record["last_accepted_at"]) + 60:
            fail("COOLDOWN")
        self._evaluate(record, "retry_closure", caller, expected_revision)

    @gl.public.view
    def get_case(self, case_id: u256) -> str:
        uint(case_id)
        return self.cases.get(case_id, "null")

    @gl.public.view
    def get_version(self, case_id: u256, revision: u256) -> str:
        return self.history.get(decimal(case_id) + ":" + decimal(revision), "null")

    @gl.public.view
    def get_id_by_nonce(self, creator: Address, nonce: str) -> u256:
        creator_key = address(creator)
        nonce = text(nonce, 32)
        if not NONCE_RE.fullmatch(nonce):
            fail("BAD_SCHEMA")
        return self.nonce_index.get(creator_key + ":" + nonce, u256(0))

    @gl.public.view
    def get_count(self) -> u256:
        return self.case_count

    def _page(self, ids, offset: int, limit: int):
        selected = ids[offset:offset + limit]
        next_offset = offset + len(selected)
        return canonical({"ids": selected, "next": str(next_offset if next_offset < len(ids) else 0)})

    @gl.public.view
    def list_cases(self, start_id: u256, limit: u256) -> str:
        start = uint(start_id)
        size = uint(limit)
        if start < 1 or start > 33 or size < 1 or size > 4:
            fail("BAD_PAGE")
        ids = [str(value) for value in range(start, min(int(self.case_count), start + size - 1) + 1)]
        next_id = start + len(ids)
        return canonical({"ids": ids, "next": str(next_id if next_id <= int(self.case_count) else 0)})

    @gl.public.view
    def list_actor(self, actor: Address, offset: u256, limit: u256) -> str:
        position = uint(offset)
        size = uint(limit)
        if position < 0 or position > 32 or size < 1 or size > 4:
            fail("BAD_PAGE")
        return self._page(json.loads(self.actor_index.get(address(actor), "[]")), position, size)

    @gl.public.view
    def list_children(self, parent_id: u256, offset: u256, limit: u256) -> str:
        uint(parent_id)
        position = uint(offset)
        size = uint(limit)
        if position < 0 or position > 32 or size < 1 or size > 4:
            fail("BAD_PAGE")
        return self._page(json.loads(self.child_index.get(parent_id, "[]")), position, size)
