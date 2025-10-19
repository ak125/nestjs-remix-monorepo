"""
AI Agents - Python Local System
Entry point pour exécution locale des agents
"""

import sys
import argparse
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from core.config import Config
from core.runner import AgentRunner
from core.evidence import EvidenceLogger

console = Console()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="AI Agents - Local Fix+Proof System"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without applying fixes"
    )
    parser.add_argument(
        "--analyze-only",
        action="store_true",
        help="Only run analysis agents (no fixes)"
    )
    parser.add_argument(
        "--fix-only",
        nargs="+",
        help="Only run specific fix agents (e.g., f1 f3)"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="config.yaml",
        help="Path to config file"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    # Load config
    config = Config.load(args.config)
    if args.verbose:
        config.output.verbose = True
    
    # Create evidence logger
    evidence = EvidenceLogger(config)
    
    # Print header
    console.print(
        Panel.fit(
            "🤖 AI Agents - Local Fix+Proof System",
            style="bold blue"
        )
    )
    
    # Create runner
    runner = AgentRunner(config, evidence, dry_run=args.dry_run)
    
    try:
        # Phase 1: Analysis
        if not args.fix_only:
            console.print("\n📋 [bold]ANALYSE[/bold] (12 agents)")
            console.print("━" * 50)
            
            analysis_results = runner.run_analysis_agents()
            
            if args.analyze_only:
                runner.print_summary(analysis_results)
                return 0
        
        # Phase 2: Corrections
        console.print("\n🔧 [bold]CORRECTIONS[/bold]")
        console.print("━" * 50)
        
        fix_results = runner.run_fix_agents(
            specific=args.fix_only
        )
        
        # Phase 3: Validation
        console.print("\n🧪 [bold]VALIDATION[/bold] (M1-M7)")
        console.print("━" * 50)
        
        validation_results = runner.run_validation()
        
        # Phase 4: Decision
        console.print("\n📊 [bold]DECISION[/bold] (F15)")
        console.print("━" * 50)
        
        decision = runner.calculate_decision(
            analysis_results,
            fix_results,
            validation_results
        )
        
        # Print final summary
        runner.print_final_summary(decision)
        
        # Save evidence
        evidence.save()
        
        # Return exit code
        if decision.action == "SAFE_TO_COMMIT":
            console.print("\n✅ [bold green]ALL CHECKS PASSED - Commit autorisé![/bold green]")
            return 0
        elif decision.action == "REVIEW_REQUIRED":
            console.print("\n⚠️ [bold yellow]REVIEW REQUIRED - Vérification manuelle nécessaire[/bold yellow]")
            return 1
        else:  # REJECT
            console.print("\n❌ [bold red]CHECKS FAILED - Corrections manuelles requises[/bold red]")
            return 1
            
    except KeyboardInterrupt:
        console.print("\n⚠️ Interrupted by user")
        return 130
    except Exception as e:
        console.print(f"\n❌ [bold red]Error:[/bold red] {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
