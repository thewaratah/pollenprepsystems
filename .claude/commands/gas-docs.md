Use the `gas-docs-formatter-agent` sub-agent to handle this Google Docs formatting task in GAS:

$ARGUMENTS

The agent specialises in DocumentApp API patterns, the hybrid template engine (v4.2), and the insert-index / append path symmetry used in GoogleDocsPrepSystem.gs. It holds a complete DocumentApp cheatsheet inline and a full reference of existing formatting helpers. It will read the relevant function(s) before making any change, maintain both code paths, and gate the result on gas-code-review-agent before deployment.

Specify the venue (Waratah or Sakura) and which document type(s) are affected if known.
