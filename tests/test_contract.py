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
