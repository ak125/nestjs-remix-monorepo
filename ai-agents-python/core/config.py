"""
Configuration management for AI Agents
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any
from pathlib import Path
import yaml


@dataclass
class MassiveFilesThresholds:
    tsx_component: int = 500
    route_file: int = 400
    backend_service: int = 600
    typescript: int = 350
    javascript: int = 350


@dataclass
class DuplicationThresholds:
    min_tokens: int = 6
    min_lines: int = 5
    similarity_threshold: float = 0.95


@dataclass
class DeadCodeThresholds:
    untouched_days: int = 30
    min_confidence: float = 0.9


@dataclass
class ThresholdsConfig:
    massive_files: MassiveFilesThresholds = field(default_factory=MassiveFilesThresholds)
    duplication: DuplicationThresholds = field(default_factory=DuplicationThresholds)
    dead_code: DeadCodeThresholds = field(default_factory=DeadCodeThresholds)
    
    # Legacy aliases pour compatibilité
    @property
    def massive_files_tsx(self) -> int:
        return self.massive_files.tsx_component
    
    @property
    def duplication_tokens(self) -> int:
        return self.duplication.min_tokens
    
    @property
    def dead_code_days(self) -> int:
        return self.dead_code.untouched_days


@dataclass
class AutoFixConfig:
    dead_code: bool = True
    lint_errors: bool = True
    format_code: bool = True
    duplications: bool = False
    massive_files: bool = False


@dataclass
class TestsConfig:
    diff_coverage_min: int = 80
    mutation_score_min: int = 80
    skip_mutation_in_dev: bool = True
    skip_ui_snapshots_in_dev: bool = True


@dataclass
class OutputConfig:
    format: str = "markdown"
    verbose: bool = True
    reports_dir: str = ".ai-agents/reports"
    evidence_dir: str = ".ai-agents/evidence"
    logs_dir: str = ".ai-agents/logs"


@dataclass
class RiskConfig:
    low_risk_max: int = 30
    medium_risk_max: int = 60


@dataclass
class ConfidenceConfig:
    high_confidence_min: int = 95
    medium_confidence_min: int = 90


@dataclass
class DecisionThreshold:
    max_risk: int
    min_confidence: int


@dataclass
class DecisionConfig:
    auto_commit_if: DecisionThreshold = field(default_factory=lambda: DecisionThreshold(max_risk=30, min_confidence=95))
    review_if: DecisionThreshold = field(default_factory=lambda: DecisionThreshold(max_risk=60, min_confidence=90))


@dataclass
class Config:
    """Main configuration class"""
    
    thresholds: ThresholdsConfig = field(default_factory=ThresholdsConfig)
    auto_fix: AutoFixConfig = field(default_factory=AutoFixConfig)
    tests: TestsConfig = field(default_factory=TestsConfig)
    output: OutputConfig = field(default_factory=OutputConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    confidence: ConfidenceConfig = field(default_factory=ConfidenceConfig)
    decision: DecisionConfig = field(default_factory=DecisionConfig)
    
    mode: str = "local"
    exclude_dirs: List[str] = field(default_factory=lambda: [
        "node_modules", "dist", "build", ".next", ".cache",
        "coverage", ".git", "__pycache__", ".venv", "venv"
    ])
    exclude_patterns: List[str] = field(default_factory=lambda: [
        "*.min.js", "*.d.ts", "*.test.ts", "*.spec.ts"
    ])
    
    @classmethod
    def load(cls, config_path: str = "config.yaml") -> "Config":
        """Load configuration from YAML file"""
        config_file = Path(config_path)
        
        if not config_file.exists():
            # Return default config
            return cls()
        
        with open(config_file, 'r') as f:
            data = yaml.safe_load(f)
        
        # Parse nested config
        config = cls()
        
        if "thresholds" in data:
            th = data["thresholds"]
            
            # Massive files
            if "massive_files" in th:
                mf = th["massive_files"]
                config.thresholds.massive_files = MassiveFilesThresholds(
                    tsx_component=mf.get("tsx_component", 500),
                    route_file=mf.get("route_file", 400),
                    backend_service=mf.get("backend_service", 600),
                    typescript=mf.get("typescript", 350),
                    javascript=mf.get("javascript", 350)
                )
            
            # Duplication
            if "duplication" in th:
                dup = th["duplication"]
                config.thresholds.duplication = DuplicationThresholds(
                    min_tokens=dup.get("min_tokens", 6),
                    min_lines=dup.get("min_lines", 5),
                    similarity_threshold=dup.get("similarity_threshold", 0.95)
                )
            
            # Dead code
            if "dead_code" in th:
                dc = th["dead_code"]
                config.thresholds.dead_code = DeadCodeThresholds(
                    untouched_days=dc.get("untouched_days", 30),
                    min_confidence=dc.get("min_confidence", 0.9)
                )
        
        if "auto_fix" in data:
            af = data["auto_fix"]
            config.auto_fix.dead_code = af.get("dead_code", True)
            config.auto_fix.lint_errors = af.get("lint_errors", True)
            config.auto_fix.duplications = af.get("duplications", False)
            config.auto_fix.massive_files = af.get("massive_files", False)
        
        if "tests" in data:
            t = data["tests"]
            config.tests.diff_coverage_min = t.get("diff_coverage_min", 80)
            config.tests.mutation_score_min = t.get("mutation_score_min", 80)
        
        if "output" in data:
            o = data["output"]
            config.output.format = o.get("format", "markdown")
            config.output.verbose = o.get("verbose", True)
            config.output.reports_dir = o.get("reports_dir", ".ai-agents/reports")
        
        if "risk" in data:
            r = data["risk"]
            config.risk.low_risk_max = r.get("low_risk_max", 30)
            config.risk.medium_risk_max = r.get("medium_risk_max", 60)
        
        if "confidence" in data:
            c = data["confidence"]
            config.confidence.high_confidence_min = c.get("high_confidence_min", 95)
            config.confidence.medium_confidence_min = c.get("medium_confidence_min", 90)
        
        if "decision" in data:
            d = data["decision"]
            if "auto_commit_if" in d:
                auto = d["auto_commit_if"]
                config.decision.auto_commit_if = DecisionThreshold(
                    max_risk=auto.get("max_risk", 30),
                    min_confidence=auto.get("min_confidence", 95)
                )
            if "review_if" in d:
                review = d["review_if"]
                config.decision.review_if = DecisionThreshold(
                    max_risk=review.get("max_risk", 60),
                    min_confidence=review.get("min_confidence", 90)
                )
        
        if "exclude" in data:
            ex = data["exclude"]
            if "directories" in ex:
                config.exclude_dirs = ex["directories"]
            if "patterns" in ex:
                config.exclude_patterns = ex["patterns"]
        
        config.mode = data.get("mode", "local")
        
        return config
    
    def should_exclude(self, path: Path) -> bool:
        """Check if path should be excluded"""
        path_str = str(path)
        
        # Check directories
        for exclude_dir in self.exclude_dirs:
            if f"/{exclude_dir}/" in path_str or path_str.startswith(exclude_dir):
                return True
        
        # Check patterns
        for pattern in self.exclude_patterns:
            if path.match(pattern):
                return True
        
        return False
