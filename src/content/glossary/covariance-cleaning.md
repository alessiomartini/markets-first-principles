---
term: "Covariance cleaning"
aliases: ["cleaning", "shrinkage", "RMT cleaning"]
track: 3
status: written
physics: "Regularisation of an ill-conditioned inverse problem, with random matrix theory supplying the null model that says which modes to keep."
---

Replacing a noisy estimated **correlation matrix** with one whose noisy modes have been suppressed, before using it in any calculation that inverts it. Methods range from simple shrinkage toward the identity to eigenvalue clipping guided by the **eigenvalue spectrum**. It is not optional cosmetics: portfolio optimisation inverts the matrix, inversion amplifies exactly the smallest and noisiest eigenvalues, and an uncleaned matrix therefore produces portfolios that load maximally on estimation error.
