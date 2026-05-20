"""
Pydantic v2 models partagés entre les 4 scripts du pipeline wiki-promotion.

Définit les contrats typés pour :
- RawManifest    (sortie capture-web-to-raw)
- Claim          (sortie extract-claims)
- SourceMap      (sortie build-source-map)
- ProposalSpec   (entrée render-proposal)

Aucune dépendance à DB, LLM, ou état applicatif. Stateless.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class EntityType(str, Enum):
    """5 entity_types canoniques per ADR-031 §148 (singulier strict)."""

    GAMME = "gamme"
    VEHICLE = "vehicle"
    CONSTRUCTEUR = "constructeur"
    SUPPORT = "support"
    DIAGNOSTIC = "diagnostic"


class TrustLevel(str, Enum):
    """Niveau de confiance source per `_meta/source-policy.md`."""

    LOW = "0_low"
    CONSULTING = "1_consulting"
    MEDIUM_CONCORDANT = "2_medium_concordant"
    HIGH_SPECIALIZED = "3_high_specialized"


class SourceLevel(str, Enum):
    """Source provenance per raw repo conventions."""

    WEB = "web"
    PDF = "pdf"
    DB = "db"
    MANUAL = "manual"


class ExtractionMethod(str, Enum):
    """Méthode d'extraction déterministe (aucun LLM)."""

    JSONLD_DIRECT_LIFT = "jsonld_direct_lift"
    READABILITY = "readability"
    TRAFILATURA = "trafilatura"
    DOM_SELECTOR = "dom_selector"


class RawManifest(BaseModel):
    """
    Sidecar manifest pour un fichier raw capturé. Content-addressed :
    `content_hash` = sha256(body), filename = `<content_hash>.html`.
    """

    model_config = ConfigDict(extra="forbid")

    content_hash: str = Field(
        pattern=r"^sha256:[a-f0-9]{64}$",
        description="sha256 du body HTML brut (filename = <hash>.html)",
    )
    url: HttpUrl
    captured_at: datetime
    origin_repo: Literal["automecanik-raw"] = "automecanik-raw"
    source_level: SourceLevel = SourceLevel.WEB
    trust_level: TrustLevel
    can_feed_wiki: bool = Field(
        default=False,
        description="Si True, la source est validée pour promotion vers wiki. "
        "Toujours False à la capture initiale ; flip humain après revue.",
    )
    http_status: int = Field(ge=100, le=599)
    content_length_bytes: int = Field(ge=0)
    user_agent: str
    capture_tool: str = Field(default="playwright")
    capture_tool_version: str


class Claim(BaseModel):
    """
    Affirmation factuelle extraite d'une source raw, avec source_url +
    selector/path d'extraction (provenance vérifiable).

    Aucune génération LLM : `text` est toujours une citation littérale ou
    une valeur structurée directement lue du document source.
    """

    model_config = ConfigDict(extra="forbid")

    claim_id: str = Field(
        pattern=r"^claim-[a-f0-9]{16}$",
        description="sha256(source_url + selector + text)[:16] préfixé 'claim-'",
    )
    text: str = Field(min_length=1, max_length=4000)
    source_url: HttpUrl
    source_content_hash: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    extraction_method: ExtractionMethod
    selector: str | None = Field(
        default=None,
        description="CSS selector OU XPath OU JSON-LD path selon extraction_method",
    )
    extracted_at: datetime


class ClaimSet(BaseModel):
    """Conteneur typed pour la sortie YAML d'extract-claims."""

    model_config = ConfigDict(extra="forbid")

    source_manifest: str = Field(
        description="Chemin relatif vers le RawManifest associé (e.g. 'sources/web-corpus/2026-05-13/<hash>.manifest.yaml')"
    )
    claims: list[Claim]
    extracted_at: datetime
    extractor_version: str = Field(default="1.0.0")
    rejected_reasons: list[str] = Field(
        default_factory=list,
        description="Raisons pour lesquelles aucune claim n'a été extraite (ex: 'no_jsonld', 'readability_below_threshold')",
    )


class SourceMapEntry(BaseModel):
    """Une entrée du source-map : claim ↔ source vérifiable."""

    model_config = ConfigDict(extra="forbid")

    claim_id: str = Field(pattern=r"^claim-[a-f0-9]{16}$")
    url: HttpUrl
    selector: str | None
    quote_verbatim: str = Field(min_length=1)
    extracted_at: datetime
    extractor_name: ExtractionMethod


class SourceMap(BaseModel):
    """Sortie de build-source-map : claims indexés par claim_id avec provenance."""

    model_config = ConfigDict(extra="forbid")

    entity_type: EntityType
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$")
    title: str = Field(min_length=1, max_length=200)
    entries: list[SourceMapEntry]
    built_at: datetime
    builder_version: str = Field(default="1.0.0")


class ProposalSpec(BaseModel):
    """
    Entrée minimale pour render-proposal : ce qui doit apparaître dans le
    frontmatter v1.0.0 + corps markdown structuré.

    Validation contre `automecanik-wiki/_meta/schema/frontmatter.schema.json`
    effectuée par render-proposal avant écriture.
    """

    model_config = ConfigDict(extra="forbid")

    entity_type: EntityType
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$")
    title: str = Field(min_length=1, max_length=200)
    aliases: list[str] = Field(default_factory=list)
    lang: Literal["fr", "en"] = "fr"
    truth_level: Literal["L0", "L1", "L2", "L3"] = "L1"
    source_map: SourceMap
    body_md: str = Field(min_length=1, description="Corps markdown (sans frontmatter)")
