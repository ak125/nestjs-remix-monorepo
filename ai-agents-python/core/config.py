"""
Configuration management for AI Agents
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any
from pathlib import Path
import yaml


@dataclass
class ThresholdsConfig:
    massive_files_tsx: int = 500
    massive_files_route: int = 400
    massive_files_service: int = 300
    duplication_tokens: int = 6
    dead_code_days: int = 30
    css_pattern_occurrences: int = 50
    p95_api_ms: int = 200
    bundle_size_kb: int = 500


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
class Config:
    """Main configuration class"""
    
    thresholds: ThresholdsConfig = field(default_factory=ThresholdsConfig)
    auto_fix: AutoFixConfig = field(default_factory=AutoFixConfig)
    tests: TestsConfig = field(default_factory=TestsConfig)
    output: OutputConfig = field(default_factory=OutputConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    confidence: ConfidenceConfig = field(default_factory=ConfidenceConfig)
    
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
            if "massive_files" in th:
                mf = th["massive_files"]
                config.thresholds.massive_files_tsx = mf.get("tsx_component", 500)
                config.thresholds.massive_files_route = mf.get("route_file", 400)
                config.thresholds.massive_files_service = mf.get("service_file", 300)
            if "duplication" in th:
                config.thresholds.duplication_tokens = th["duplication"].get("min_tokens", 6)
            if "dead_code" in th:
                config.thresholds.dead_code_days = th["dead_code"].get("untouched_days", 30)
            if "css" in th:
                config.thresholds.css_pattern_occurrences = th["css"].get("min_occurrences", 50)
        
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
