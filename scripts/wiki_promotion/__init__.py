"""
wiki-promotion — pipeline déterministe raw → claims → source_map → proposal.

Scope strict (ADR-059 Phase B, PR-3a) :
- 0 LLM (extraction déterministe : Schema.org JSON-LD direct lift + Readability + Trafilatura + DOM selectors)
- 0 écriture DB
- 0 écriture wiki canon (output uniquement proposals/ ou stdout)

Output : automecanik-wiki/proposals/<slug>.md (frontmatter v1.0.0 canon).
"""
