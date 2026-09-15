/**
2
* Signals that a validated action requires explicit local approval.
3
*
4
* This gate does not grant approval. The shared broker owns approval
5
* collection, exact-action binding, expiry, redemption, and receipts.
6
*/
7
export const approvalGate = Object.freeze({
8
id: "local-approval-required",
9
 
10
async evaluate() {
11
return {
12
decision: "ask-first",
13
reason: "local-review-required",
14
findings: [],
15
};
16
},
17
});
