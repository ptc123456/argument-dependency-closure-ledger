import json
from datetime import datetime, timezone

import pytest
from gltest.direct import VMContext, create_address, deploy_contract


CONTRACT = "contracts/main.py"
NONCE = "0123456789abcdef0123456789abcdef"


def canon(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def graph(*, cycle=False, disconnected=False):
    nodes = [
        {"id": "root", "type": "CLAIM", "text": "The proposal is ready."},
        {"id": "cost", "type": "OBJECTION", "text": "The cost estimate is unsupported."},
        {"id": "evidence", "type": "CLAIM", "text": "A public estimate is attached."},
    ]
    edges = [
        {"from": "cost", "to": "root", "type": "ATTACKS"},
        {"from": "evidence", "to": "cost", "type": "SUPPORTS"},
    ]
    if cycle:
        edges.append({"from": "root", "to": "evidence", "type": "SUPPORTS"})
    if disconnected:
        nodes.append({"id": "timing", "type": "OBJECTION", "text": "A disconnected concern."})
    return {"root_id": "root", "nodes": nodes, "edges": edges}


@pytest.fixture
def setup():
    vm = VMContext()
    owner = create_address("owner")
    responder = create_address("responder")
    outsider = create_address("outsider")
    vm.sender = owner
    with vm.activate():
        contract = deploy_contract(CONTRACT, vm)
        yield vm, contract, owner, responder, outsider


def create(vm, contract, owner, responder, base=None, nonce=NONCE):
    vm.sender = owner
    return contract.create_graph(nonce, responder, canon(base or graph()), 0)


def freeze(vm, contract, owner, responder, replies, base=None):
    case_id = create(vm, contract, owner, responder, base)
    contract.lock_graph(case_id, 1)
    vm.sender = responder
    contract.put_replies(case_id, canon({"replies": replies}), 2)
    contract.freeze_replies(case_id, 3)
    return case_id


def record(contract, case_id):
    return json.loads(contract.get_case(case_id))


def test_create_replay_indexes_history_and_nonce_conflict(setup):
    vm, contract, owner, responder, _ = setup
    case_id = create(vm, contract, owner, responder)
    before = contract.get_case(case_id)
    assert int(case_id) == 1
    assert int(contract.get_count()) == 1
    assert contract.get_version(case_id, 1) == before
    assert int(contract.get_id_by_nonce(owner, NONCE)) == 1
    assert json.loads(contract.list_actor(owner, 0, 4))["ids"] == ["1"]
    assert int(create(vm, contract, owner, responder)) == 1
    assert contract.get_case(case_id) == before
    assert int(contract.get_count()) == 1
    with pytest.raises(Exception, match="NONCE_CONFLICT"):
        create(vm, contract, owner, responder, graph(disconnected=True))
    assert contract.get_case(case_id) == before


def test_create_accepts_integer_abi_address_representation(setup):
    vm, contract, owner, responder, _ = setup
    responder_int = int.from_bytes(responder, "big")
    vm.sender = owner
    case_id = contract.create_graph(NONCE, responder_int, canon(graph()), 0)
    current = record(contract, case_id)
    assert current["secondary"] == "0x" + responder.hex()
    assert int(contract.get_count()) == 1


def test_authority_cas_duplicate_json_and_unknown_keys_are_no_write(setup):
    vm, contract, owner, responder, outsider = setup
    case_id = create(vm, contract, owner, responder)
    before = contract.get_case(case_id)
    vm.sender = outsider
    with pytest.raises(Exception, match="FORBIDDEN"):
        contract.lock_graph(case_id, 1)
    assert contract.get_case(case_id) == before
    vm.sender = owner
    with pytest.raises(Exception, match="STALE_REVISION"):
        contract.lock_graph(case_id, 2)
    assert contract.get_case(case_id) == before
    duplicate = '{"root_id":"root","root_id":"other","nodes":[],"edges":[]}'
    with pytest.raises(Exception, match="BAD_JSON"):
        contract.replace_graph(case_id, duplicate, 1)
    assert contract.get_case(case_id) == before
    bad = graph()
    bad["extra"] = True
    with pytest.raises(Exception, match="BAD_SCHEMA"):
        contract.replace_graph(case_id, canon(bad), 1)
    assert contract.get_case(case_id) == before


@pytest.mark.parametrize(
    "label,outcome",
    [
        ("ADDRESSES", "CLOSED_FOR_DECISION"),
        ("PARTIAL", "OPEN_OBJECTIONS"),
        ("NONRESPONSIVE", "OPEN_OBJECTIONS"),
        ("UNKNOWN", "UNRESOLVED"),
    ],
)
def test_direct_reply_reducer(setup, label, outcome):
    vm, contract, owner, responder, outsider = setup
    case_id = freeze(
        vm,
        contract,
        owner,
        responder,
        [{"target": "cost", "text": "The estimate follows the published unit costs."}],
    )
    vm.sender = outsider
    vm.mock_llm(r"Classify each reply", canon({"v": 1, "labels": [label]}))
    contract.evaluate_closure(case_id, 4)
    current = record(contract, case_id)
    assert current["outcome"] == outcome
    assert current["phase"] == ("UNRESOLVED" if outcome == "UNRESOLVED" else "DONE")
    assert current["result"] == {"v": 1, "labels": [label]}
    assert current["accepted_attempts"] == 1
    assert json.loads(contract.get_version(case_id, 5))["last_operation"]["method"] == "evaluate_closure"


def test_missing_relevant_reply_open_but_disconnected_unknown_is_ignored(setup):
    vm, contract, owner, responder, outsider = setup
    base = graph(disconnected=True)
    case_id = freeze(
        vm,
        contract,
        owner,
        responder,
        [{"target": "timing", "text": "I cannot determine the timing concern."}],
        base,
    )
    vm.sender = outsider
    vm.mock_llm(r"Classify each reply", canon({"v": 1, "labels": ["UNKNOWN"]}))
    contract.evaluate_closure(case_id, 4)
    assert record(contract, case_id)["outcome"] == "OPEN_OBJECTIONS"


def test_cycle_anywhere_short_circuits_without_llm(setup):
    vm, contract, owner, responder, outsider = setup
    case_id = freeze(vm, contract, owner, responder, [], graph(cycle=True))
    vm.sender = outsider
    contract.evaluate_closure(case_id, 4)
    current = record(contract, case_id)
    assert current["outcome"] == "GRAPH_INVALID"
    assert current["result"] == {"v": 1, "labels": []}


def test_empty_replies_without_objections_closes_without_llm(setup):
    vm, contract, owner, responder, outsider = setup
    base = {"root_id": "root", "nodes": [{"id": "root", "type": "CLAIM", "text": "Ready"}], "edges": []}
    case_id = freeze(vm, contract, owner, responder, [], base)
    vm.sender = outsider
    contract.evaluate_closure(case_id, 4)
    assert record(contract, case_id)["outcome"] == "CLOSED_FOR_DECISION"


def test_validator_rejects_changed_consequential_label(setup):
    vm, contract, owner, responder, outsider = setup
    case_id = freeze(
        vm,
        contract,
        owner,
        responder,
        [{"target": "cost", "text": "The estimate follows published unit costs."}],
    )
    vm.sender = outsider
    vm.mock_llm(r"Classify each reply", canon({"v": 1, "labels": ["ADDRESSES"]}))
    contract.evaluate_closure(case_id, 4)
    vm.mock_llm(r"Classify each reply", canon({"v": 1, "labels": ["ADDRESSES"]}))
    assert vm.run_validator(leader_result={"v": 1, "labels": ["PARTIAL"]}) is False


def test_malformed_result_is_no_write(setup):
    vm, contract, owner, responder, outsider = setup
    case_id = freeze(
        vm,
        contract,
        owner,
        responder,
        [{"target": "cost", "text": "A response."}],
    )
    before = contract.get_case(case_id)
    vm.sender = outsider
    vm.mock_llm(r"Classify each reply", canon({"v": 1, "labels": []}))
    with pytest.raises(Exception, match="MALFORMED_RESULT"):
        contract.evaluate_closure(case_id, 4)
    assert contract.get_case(case_id) == before
    assert contract.get_version(case_id, 5) == "null"


def test_retry_cooldown_and_exhaustion(setup):
    vm, contract, owner, responder, outsider = setup
    case_id = freeze(
        vm,
        contract,
        owner,
        responder,
        [{"target": "cost", "text": "Ambiguous response."}],
    )
    vm.sender = outsider
    for expected_revision, offset in ((4, 0), (5, 60), (6, 120)):
        vm.warp(datetime.fromtimestamp(1767225600 + offset, timezone.utc).isoformat())
        vm.mock_llm(r"Classify each reply", canon({"v": 1, "labels": ["UNKNOWN"]}))
        if expected_revision == 4:
            contract.evaluate_closure(case_id, expected_revision)
        else:
            contract.retry_closure(case_id, expected_revision)
    current = record(contract, case_id)
    assert current["accepted_attempts"] == 3
    assert current["phase"] == "EXHAUSTED"
    with pytest.raises(Exception, match="BAD_PHASE"):
        contract.retry_closure(case_id, 7)


@pytest.mark.parametrize(
    "edges",
    [
        [
            {"from": "a", "to": "b", "type": "SUPPORTS"},
            {"from": "b", "to": "a", "type": "SUPPORTS"},
        ],
        [
            {"from": "a", "to": "b", "type": "ATTACKS"},
            {"from": "b", "to": "a", "type": "ATTACKS"},
        ],
        [
            {"from": "a", "to": "b", "type": "SUPPORTS"},
            {"from": "b", "to": "a", "type": "ATTACKS"},
        ],
    ],
)
def test_disconnected_support_attack_and_mixed_cycles_are_invalid(setup, edges):
    vm, contract, owner, responder, outsider = setup
    base = {
        "root_id": "root",
        "nodes": [
            {"id": "root", "type": "CLAIM", "text": "Ready"},
            {"id": "a", "type": "CLAIM", "text": "Disconnected A"},
            {"id": "b", "type": "OBJECTION", "text": "Disconnected B"},
        ],
        "edges": edges,
    }
    case_id = freeze(vm, contract, owner, responder, [], base)
    vm.sender = outsider
    contract.evaluate_closure(case_id, 4)
    assert record(contract, case_id)["outcome"] == "GRAPH_INVALID"


@pytest.mark.parametrize(
    "mutate",
    [
        lambda base: base["nodes"].append({"id": "root", "type": "CLAIM", "text": "duplicate"}),
        lambda base: base["edges"].append({"from": "root", "to": "root", "type": "SUPPORTS"}),
        lambda base: base["edges"].append({"from": "missing", "to": "root", "type": "ATTACKS"}),
        lambda base: base["nodes"].__setitem__(0, {"id": "root", "type": "OBJECTION", "text": "wrong root"}),
        lambda base: base["nodes"].__setitem__(1, {"id": "BAD-ID", "type": "OBJECTION", "text": "bad id"}),
        lambda base: base["nodes"].__setitem__(1, {"id": "cost", "type": "OBJECTION", "text": True}),
    ],
)
def test_invalid_graph_shapes_are_rejected_before_create(setup, mutate):
    vm, contract, owner, responder, _ = setup
    base = graph()
    mutate(base)
    before_count = int(contract.get_count())
    with pytest.raises(Exception, match="BAD_SCHEMA"):
        create(vm, contract, owner, responder, base)
    assert int(contract.get_count()) == before_count
    assert int(contract.get_id_by_nonce(owner, NONCE)) == 0


def test_response_target_and_size_boundaries_are_no_write(setup):
    vm, contract, owner, responder, _ = setup
    case_id = create(vm, contract, owner, responder)
    contract.lock_graph(case_id, 1)
    vm.sender = responder
    before = contract.get_case(case_id)
    cases = [
        {"replies": [{"target": "root", "text": "Claim is not an objection"}]},
        {"replies": [{"target": "cost", "text": "one"}, {"target": "cost", "text": "two"}]},
        {"replies": [{"target": "cost", "text": "x" * 385}]},
        {"replies": [], "extra": True},
    ]
    for response in cases:
        with pytest.raises(Exception, match="BAD_SCHEMA"):
            contract.put_replies(case_id, canon(response), 2)
        assert contract.get_case(case_id) == before


def test_parent_child_and_pagination_readback(setup):
    vm, contract, owner, responder, outsider = setup
    parent = freeze(vm, contract, owner, responder, [], {
        "root_id": "root", "nodes": [{"id": "root", "type": "CLAIM", "text": "Ready"}], "edges": []
    })
    vm.sender = outsider
    contract.evaluate_closure(parent, 4)
    vm.sender = owner
    child = contract.create_graph("1123456789abcdef0123456789abcdef", responder, canon(graph()), parent)
    assert int(child) == 2
    assert json.loads(contract.list_children(parent, 0, 1)) == {"ids": ["2"], "next": "0"}
    assert json.loads(contract.list_cases(1, 1)) == {"ids": ["1"], "next": "2"}
    assert json.loads(contract.list_cases(2, 4)) == {"ids": ["2"], "next": "0"}
    with pytest.raises(Exception, match="BAD_PAGE"):
        contract.list_cases(0, 1)
    with pytest.raises(Exception, match="BAD_PAGE"):
        contract.list_actor(owner, 33, 1)


def test_nonterminal_or_different_party_parent_rejects_without_reservation(setup):
    vm, contract, owner, responder, outsider = setup
    parent = create(vm, contract, owner, responder)
    with pytest.raises(Exception, match="BAD_PARENT"):
        contract.create_graph("2123456789abcdef0123456789abcdef", responder, canon(graph()), parent)
    assert int(contract.get_count()) == 1
    contract.lock_graph(parent, 1)
    vm.sender = responder
    contract.put_replies(parent, canon({"replies": []}), 2)
    contract.freeze_replies(parent, 3)
    vm.sender = outsider
    contract.evaluate_closure(parent, 4)
    vm.sender = owner
    with pytest.raises(Exception, match="BAD_PARENT"):
        contract.create_graph("3123456789abcdef0123456789abcdef", outsider, canon(graph()), parent)
    assert int(contract.get_count()) == 1


def test_bool_and_aggregate_caps_are_rejected_without_mutation(setup):
    vm, contract, owner, responder, _ = setup
    before = int(contract.get_count())
    oversized = canon(graph()) + (" " * 8192)
    with pytest.raises(Exception, match="BAD_JSON"):
        contract.create_graph(NONCE, responder, oversized, 0)
    assert int(contract.get_count()) == before
    case_id = create(vm, contract, owner, responder)
    with pytest.raises(Exception):
        contract.lock_graph(case_id, True)
    assert record(contract, case_id)["revision"] == "1"


def test_revision_reserve_boundaries_leave_three_evaluation_attempts(setup):
    vm, contract, owner, responder, _ = setup
    case_id = create(vm, contract, owner, responder)
    for expected_revision in range(1, 26):
        contract.replace_graph(case_id, canon(graph()), expected_revision)
    assert record(contract, case_id)["revision"] == "26"
    with pytest.raises(Exception, match="CAPACITY"):
        contract.replace_graph(case_id, canon(graph()), 26)

    contract.lock_graph(case_id, 26)
    vm.sender = responder
    contract.put_replies(case_id, canon({"replies": []}), 27)
    assert record(contract, case_id)["revision"] == "28"
    with pytest.raises(Exception, match="CAPACITY"):
        contract.put_replies(case_id, canon({"replies": []}), 28)
