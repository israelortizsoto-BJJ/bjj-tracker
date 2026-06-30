#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ods.commands import ADD_RECORD_TYPES, COMMAND_HELP, run_command
from ods.commands.add import AddError
from ods.commands.capture import CaptureError
from ods.commands.ingest import IngestError
from ods.commands.proposal import ProposalError
from ods.generators.eod import EodError
from ods.generators.morning import MorningError
from ods.generators.today import TodayError
from ods.config import get_store_path
from ods.knowledge_store import StoreError, load_store

STORE_OPTIONAL_COMMANDS = frozenset({"init", "validate", "version", "proposal"})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ods-eos",
        description="ODS Engineering Operating System",
    )
    subparsers = parser.add_subparsers(dest="command")

    for name, help_text in COMMAND_HELP.items():
        if name == "add":
            add_parser = subparsers.add_parser(name, help=help_text)
            add_subparsers = add_parser.add_subparsers(dest="record_type")
            for record_type in ADD_RECORD_TYPES:
                add_subparsers.add_parser(record_type)
            continue
        if name == "ingest":
            ingest_parser = subparsers.add_parser(name, help=help_text)
            ingest_parser.add_argument(
                "payload",
                help="Path to canonical promotion payload JSON file.",
            )
            continue
        if name == "proposal":
            proposal_parser = subparsers.add_parser(name, help=help_text)
            proposal_parser.add_argument(
                "input",
                help="Path to structured operator proposal input (.yaml, .yml, or .json).",
            )
            continue
        subparsers.add_parser(name, help=help_text)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    if args.command in STORE_OPTIONAL_COMMANDS:
        try:
            return run_command(
                args.command,
                proposal_input_path=Path(args.input) if args.command == "proposal" else None,
            )
        except (ProposalError, StoreError) as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 1

    try:
        load_store(get_store_path())
    except StoreError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    record_type = getattr(args, "record_type", None)
    payload_path = getattr(args, "payload", None)

    try:
        return run_command(
            args.command,
            record_type=record_type,
            payload_path=Path(payload_path) if payload_path else None,
        )
    except (AddError, CaptureError, IngestError, ProposalError, EodError, MorningError, TodayError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except StoreError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
