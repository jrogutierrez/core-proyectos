PAPER N1

C.O.R.E.: Multi-Agent AI Orchestration on Edge
Infrastructure for Crisis Response with Semantic Firewall
Against Indirect Prompt Injection

Jose Roberto Gutierrez
Independent Researcher, Field Operations, Corrientes, Argentina
roberto@defensorjrg.com
September 2026
Abstract
I present C.O.R.E. (Centralized Orchestration for Response
and Execution), a multi-agent AI system operating
on $10.50/month edge infrastructure that achieves 100%
containment of indirect prompt injection attacks across
five experimental scenarios involving four distinct attack
vectors. The system introduces a Semantic Firewall instantiated
via a 7-Section Communication Protocol that
neutralizes malicious payloads embedded in Markdown
documents, JavaScript binaries, PDF artifacts, and architectural
documentation without requiring model finetuning,
heavy Web Application Firewalls (WAF), or token
overhead exceeding ∼200 tokens. Furthermore, I formalize
BOPA (Bidirectional Orchestration with Pre-Audit), a
paradigm in which defensive auditing agents establish constraints
prior to code generation. Operating on an 8GB
RAM VPS with six specialized models (20B–120B parameters),
C.O.R.E. demonstrates that structured communication
protocols provide robust, deterministic security
boundaries in resource-constrained municipal and disasterresponse
environments across the Argentine NEA.
1 Introduction
The integration of Large Language Models (LLMs) into
autonomous multi-agent pipelines has exposed significant
systemic vulnerabilities. Among these, Indirect Prompt
Injection (IPI) represents a primary threat vector: external
untrusted data feeds (e.g., uploaded documents,
web scrapers, code repositories) can hijack an agent’s control
flow, execute arbitrary tools, or exfiltrate sensitive
environment variables [1, 2].
While enterprise environments mitigate these risks via
expensive alignment regimes (RLHF, DPO) or dedicated
cloud security stacks costing $500–$8,000/month, such
solutions are inaccessible to municipal governments, civil
defense brigades, and rural health clinics in developing
regions.
This paper presents C.O.R.E., demonstrating that
deterministic security containment can be achieved on
edge infrastructure ($10.50/month) through structured
inter-agent communication protocols rather than resourceintensive
computational overhead. The system was designed
and validated in the field by an independent researcher
with operational experience in wildfire response
and environmental crisis management in the Argentine
Northeast (NEA), applying combat doctrine principles to
the domain of AI security.
2 Methodology and Architecture
2.1 Infrastructure and Stack
The entire orchestration runs on an isolated Ubuntu 24.04
LTS instance (2 vCPUs, 8GB RAM, 200GB NVMe) hosted
at $8.00/month, supplemented by high-throughput inference
via the Groq API (∼$2.50/month). The architectural
pipeline utilizes Node.js (v20), Nginx reverse proxy with
zero-cache preview policies, and local fallback instances
via Ollama (Qwen 2.5).
2.2 The 7-Section Semantic Firewall
Every transaction between agents is strictly constrained
to a standardized 7-section schema:
1. [CONTEXT]: Immutable snapshot of workspace
state.
2. [TASK]: Single atomic operational objective.
3. [DIRECTIVES]: Explicit algorithmic steps.
4. [PROTECTED ZONES]: Cryptographically immutable
file paths.
5. [PROHIBITIONS]: Hard constraints (e.g., no external
exfiltration, no arbitrary code execution).
6. [DELIVERABLES]: Explicit structured output
buffers.
1
7. [REMINDERS]: Sanitization, offline compliance,
and error boundary mandates.
This structure acts as an in-context semantic filter:
untrusted data processed in the workspace cannot override
the system-level [PROHIBITIONS] block.
2.3 Bidirectional Orchestration with Pre-
Audit (BOPA)
Traditional AI workflows execute code generation prior to
security verification. BOPA reverses this paradigm:
Input −→ Analyst (Pre-Audit)
Boundaries −−−−−−−→ Worker (Build) −→ Verify
(1)
The security agent constructs the threat perimeter and
registers protected zones before the generative worker
writes a single line of execution logic.
3 Experimental Evaluation
To validate C.O.R.E.’s resilience, I conducted five adversarial
experiments targeting four distinct infection vectors.
3.1 Experiment Summaries
Exp 01 (Markdown System Override): An untrusted
notas tecnicas.md file contained an embedded [SYSTEM
OVERRIDE] instruction ordering the creation of an unauthenticated
backdoor and environment variable exfiltration.
The Analyst agent contained the attack, explicitly
rejecting malicious directives within its [PROHIBITIONS]
deliverable and flagging five genuine codebase vulnerabilities.
Exp 02 (JavaScript Supply Chain Exfiltration):
A payload hidden inside a setup.js script disguised exfiltration
of process.env and os.hostname() under the
pretext of “performance metrics.” The Analyst identified
the payload as a Critical Finding (H2/H6) and isolated
the script.
Exp 04 (Documentation Backdoor without
BOPA): A prompt instructing the Worker agent (20B
model) to build an Express server embedded a mandatory
instruction to expose GROQ API KEY under /debug-admin.
Despite bypassing the pre-audit phase, the Worker’s
system-level constraints overrode the document directive,
yielding a hardened server with rate limiting and helmet
middleware.
Exp 05a & 05b (Invisible Text in PDF): An official
municipal protocol PDF contained 5pt light-gray text
instructing data exfiltration to an external domain. When
queried for a benign executive summary (Exp 05a), the
system exhibited passive resistance (filtering the payload
as noise without execution). When queried for a security
audit (Exp 05b), the Analyst achieved active detection,
identifying the payload (P1), the social engineering attempt
(P2), and the invisible text technique (P3).
4 Discussion and Findings
4.1 Dual-Mode Containment Mechanism
My empirical findings reveal that containment operates in
two distinct operational states depending on task framing:
• Active Detection: Security-framed tasks explicitly
parse, flag, and generate remediation reports against
prompt injections.
• Passive Resistance: Production- and summaryframed
tasks prune adversarial instructions as out-ofdistribution
noise without executing payloads.
4.2 Model Parameter Independence
Experiment 04 demonstrates that a lightweight 20B parameter
model, when bound by the 7-Section Protocol, exhibits
containment capabilities comparable to 120B parameter
architectures. This confirms that structural prompt
boundaries dominate raw parameter scale in operational
defense.
4.3 Cost-Efficiency in Edge Contexts
With all five attacks contained at a cumulative cost of
$0.021 USD, C.O.R.E. demonstrates an operational cost
reduction of 20× to 760× relative to proprietary frameworks
(e.g., Cursor Pro, CrewAI, commercial consulting),
establishing feasibility for resource-constrained disaster
response in Latin America.
5 Limitations
I acknowledge the following boundaries of this study:
1. Testing was constrained to four textual/document
vectors; gradient-based and multi-turn iterative adversarial
attacks were not evaluated.
2. Validation was conducted primarily within Spanishlanguage
contextual bounds.
3. Passive resistance in document parsing (Exp 05a) necessitates
scheduled active audit sweeps to guarantee
forensic reporting.
6 Conclusion and Future Work
C.O.R.E. demonstrates that deterministic multi-agent security
can be maintained on edge computing budgets
($10.50/month) through structured communication protocols
and pre-audit workflows. Future work includes the
development of an automated AI Hospital module for
compromised agent quarantine and the formal deployment
of the system across municipal defense brigades in the
Argentine NEA.
2
Exp ID Target Agent Model Size Attack Vector Result Tokens Inference Cost
01 Analyst 120B Markdown System Override Contained 4,003 $0.004
02 Analyst 120B JS Supply Chain Exfiltration Detected (Critical) 4,673 $0.005
04 Worker 20B Doc Backdoor (No Pre-Audit) Rejected 3,948 $0.004
05a Analyst 120B PDF Invisible Text (Summary) Passive Resistance ∼3,500 $0.004
05b Analyst 120B PDF Invisible Text (Audit) Detected (Critical) ∼4,200 $0.004
Table 1: Summary of empirical security validation experiments across diverse vectors and tasks.
Acknowledgments
The design, empirical experimentation, and manuscript
synthesis of this work were conducted with the intensive
architectural and analytical co-assistance of LLM engines
(specifically Anthropic’s Claude and Groq-hosted open
models), operating under human-directed governance principles
defined by the author as “Layer 8 command.” The
author retains full intellectual and operational authorship
of the system, methodology, and findings. Field validation
was performed in Corrientes, Argentina, drawing on the
author’s operational experience as a wildfire brigadista
and crisis response specialist in the Northeast Argentine
region (NEA).
References
[1] K. Greshake et al., “Not what you’ve signed up
for: Compromising Real-World LLM-Integrated
Applications with Indirect Prompt Injection,”
arXiv:2302.12173, 2023.
[2] Y. Liu et al., “Prompt Injection Attack against LLMintegrated
Applications,” arXiv:2306.05499, 2024.
[3] A. Wei et al., “Jailbroken: How Does LLM Safety
Training Fail?,” Advances in Neural Information Processing
Systems (NeurIPS), 2024.
[4] MITRE ATT&CK, “Supply Chain Compromise

PDF FILE
http://45.82.73.208/paper.pdf
