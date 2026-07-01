from ods.config import get_store_dir
from ods.eos_pipeline import mission_dataset_paths, refresh_homepage_command
from ods.proof_floor import ProofFloorError, run_proof_floor


def run_proof(*, init_notion: bool = False, dry_run: bool = False) -> None:
    result = run_proof_floor(
        dataset_paths=mission_dataset_paths(),
        store_dir=get_store_dir(),
        sync_notion=not dry_run,
        init_notion=init_notion,
    )

    registry = result["registry"]

    print("Proof floor complete.")
    print(f"Events: {result['eventsPath']}")
    print(f"Mission Registry: {result['statePath']}")
    print(f"EOS: {result['eosDir']}")
    print()
    print("Mission Registry rows:")
    for row in registry.registry_rows():
        print(f"- {row['label']} ({row['missionId']}) [{row['status']}]")
        print(f"  Objective: {row['currentObjective']}")
        print(f"  Posture: {row['operationalIntent']}")
        print(f"  Latest: {row['latestEvent']}")

    if result["notionPages"]:
        print()
        print(f"Notion pages updated: {len(result['notionPages'])}")
        command = refresh_homepage_command()
        print(f"Homepage refreshed: Today's Command -> {command.command}")
