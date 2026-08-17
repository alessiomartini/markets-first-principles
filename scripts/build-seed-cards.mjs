#!/usr/bin/env node
/**
 * One-off generator for the seed decks.
 *
 * The JSON files under src/content/flashcards/ are the artefact; this script
 * exists so the first forty cards could be written as ordinary source with
 * real LaTeX rather than hand-escaped JSON strings, which is where mistakes
 * live. Delete it once the decks are edited by hand.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/content/flashcards/', import.meta.url));

// The study guide renders every topic on one route and its anchors could not be
// verified from this environment, so the primary link is the bare page with the
// section named in the label. Never a fabricated anchor.
const guide = (section) => ({
  label: `OpenQuant Study Guide — ${section}`,
  url: 'https://openquant.co/guide',
  kind: 'primary',
});
const wiki = (label, slug) => ({
  label: `Wikipedia — ${label}`,
  url: `https://en.wikipedia.org/wiki/${slug}`,
  kind: 'wikipedia',
});

const PS = 'Probability & Statistics';

const decks = [
  {
    deck: 'distributions-and-moments',
    topic: PS,
    cards: [
      {
        id: 'mgf-definition',
        type: 'formula',
        front: 'Write the moment generating function of a random variable $X$.',
        back: '$$M_X(t) = \\mathbb{E}\\left[e^{tX}\\right]$$\n\nIt exists only where the expectation is finite, which for some distributions is nowhere except $t=0$.',
        answer: 'E[e^{tX}]',
        hint: 'It is an expectation of an exponential in $X$.',
        sources: [guide(PS), wiki('Moment-generating function', 'Moment-generating_function')],
        tags: ['mgf', 'moments'],
      },
      {
        id: 'mgf-why-generates-moments',
        type: 'why',
        front: 'Why does differentiating $M_X(t)$ at $t=0$ produce the moments of $X$?',
        back: 'Expand the exponential inside the expectation: $e^{tX} = \\sum_k t^k X^k / k!$, so $M_X(t) = \\sum_k t^k \\mathbb{E}[X^k]/k!$. That is a power series whose $k$-th coefficient is $\\mathbb{E}[X^k]/k!$, and differentiating $k$ times at zero extracts exactly that coefficient. The MGF is a generating function in the ordinary combinatorial sense — the moments are its Taylor coefficients.',
        sources: [guide(PS), wiki('Moment-generating function', 'Moment-generating_function')],
        tags: ['mgf', 'moments'],
      },
      {
        id: 'mgf-variance-from-derivatives',
        type: 'formula',
        front: 'Express $\\operatorname{Var}(X)$ using derivatives of $M_X$ at zero.',
        back: '$$\\operatorname{Var}(X) = M_X\'\'(0) - \\left[M_X\'(0)\\right]^2$$\n\nThe first term is $\\mathbb{E}[X^2]$, the second is $\\left(\\mathbb{E}[X]\\right)^2$.',
        hint: 'Variance is the second moment minus the square of the first.',
        answer: "M''(0) - (M'(0))^2",
        sources: [guide(PS), wiki('Moment-generating function', 'Moment-generating_function')],
        tags: ['mgf', 'variance'],
      },
      {
        id: 'mgf-sum-independent',
        type: 'formula',
        front: 'If $X$ and $Y$ are independent, what is $M_{X+Y}(t)$?',
        back: '$$M_{X+Y}(t) = M_X(t)\\,M_Y(t)$$\n\nBecause $\\mathbb{E}[e^{t(X+Y)}] = \\mathbb{E}[e^{tX}e^{tY}]$, and independence lets the expectation factor. This is why MGFs are the standard tool for identifying the distribution of a sum.',
        answer: 'M_X(t) M_Y(t)',
        sources: [guide(PS), wiki('Moment-generating function', 'Moment-generating_function')],
        tags: ['mgf', 'independence', 'sums'],
      },
      {
        id: 'mgf-cauchy-has-none',
        type: 'why',
        front: 'Give a distribution with no moment generating function, and say what goes wrong.',
        back: 'The Cauchy distribution. Its tails decay like $x^{-2}$, so $\\mathbb{E}[e^{tX}]$ diverges for every $t \\neq 0$ — the exponential grows faster than the density decays. The same failure means the Cauchy has no finite mean either.\n\nThe practical lesson is that MGF-based arguments quietly assume the tails are light enough, and heavy-tailed financial returns are exactly where that assumption is least safe. The characteristic function $\\mathbb{E}[e^{itX}]$ always exists and is the usual replacement.',
        sources: [guide(PS), wiki('Cauchy distribution', 'Cauchy_distribution')],
        tags: ['mgf', 'heavy-tails', 'cauchy'],
      },
      {
        id: 'binomial-mean-variance',
        type: 'formula',
        front: 'State the mean and variance of $X \\sim \\text{Binomial}(n, p)$.',
        back: '$$\\mathbb{E}[X] = np, \\qquad \\operatorname{Var}(X) = np(1-p)$$\n\nBoth follow from writing $X$ as a sum of $n$ independent Bernoulli variables and using linearity for the mean, independence for the variance.',
        answer: 'np, np(1-p)',
        sources: [guide(PS), wiki('Binomial distribution', 'Binomial_distribution')],
        tags: ['binomial', 'moments'],
      },
      {
        id: 'binomial-variance-maximum',
        type: 'why',
        front: 'For fixed $n$, at what $p$ is the binomial variance largest, and why should that be obvious before computing?',
        back: 'At $p = 1/2$, giving $\\operatorname{Var} = n/4$. Maximising $p(1-p)$ is a one-line calculation, but the reason is worth seeing without it: variance measures uncertainty about the outcome, and a coin is most uncertain when it is fair. As $p \\to 0$ or $p \\to 1$ the result becomes predictable and the variance vanishes.',
        sources: [guide(PS), wiki('Binomial distribution', 'Binomial_distribution')],
        tags: ['binomial', 'variance', 'intuition'],
      },
      {
        id: 'poisson-mean-equals-variance',
        type: 'why',
        front: 'The Poisson distribution has $\\mathbb{E}[X] = \\operatorname{Var}(X) = \\lambda$. Why are they equal, and what does it let you test?',
        back: 'Take the Poisson as the limit of $\\text{Binomial}(n, \\lambda/n)$ as $n \\to \\infty$. The mean is $np = \\lambda$ throughout, and the variance is $np(1-p) = \\lambda(1 - \\lambda/n) \\to \\lambda$: the $(1-p)$ correction vanishes because each trial becomes vanishingly unlikely.\n\nIt gives a free diagnostic. Count data whose sample variance far exceeds its mean is *overdispersed* and not Poisson — usually because the rate itself varies, which is the situation a negative binomial or a Cox process is for.',
        sources: [guide(PS), wiki('Poisson distribution', 'Poisson_distribution')],
        tags: ['poisson', 'overdispersion'],
      },
      {
        id: 'exponential-memorylessness-derive',
        type: 'why',
        front: 'Derive the memorylessness of the exponential distribution, and state what it implies about a waiting time.',
        back: 'With $P(X > x) = e^{-\\lambda x}$,\n$$P(X > s+t \\mid X > s) = \\frac{e^{-\\lambda(s+t)}}{e^{-\\lambda s}} = e^{-\\lambda t} = P(X > t)$$\n\nHaving already waited $s$ tells you nothing about how much longer you will wait. The exponential is the only continuous distribution with this property, which is why it is the inter-arrival time of a Poisson process — and why using it to model something with ageing or wear is a modelling error rather than an approximation.',
        sources: [guide(PS), wiki('Exponential distribution', 'Exponential_distribution')],
        tags: ['exponential', 'memorylessness'],
      },
      {
        id: 'lognormal-mean-vs-median',
        type: 'basic',
        front: 'For $X = e^{Y}$ with $Y \\sim \\mathcal{N}(\\mu, \\sigma^2)$, give the mean and the median of $X$, and the gap between them.',
        back: '$$\\mathbb{E}[X] = e^{\\mu + \\sigma^2/2}, \\qquad \\text{median}(X) = e^{\\mu}$$\n\nThe mean exceeds the median by the factor $e^{\\sigma^2/2}$. The mean is pulled up by rare large realisations and is not where the distribution lives.\n\nThis is the same $\\sigma^2/2$ that separates the expected value of wealth from the growth rate actually experienced under a multiplicative process — the Jensen gap behind the Kelly criterion.',
        hint: 'Both are exponentials of something; only one carries a variance correction.',
        sources: [guide(PS), wiki('Log-normal distribution', 'Log-normal_distribution')],
        tags: ['lognormal', 'jensen', 'growth'],
      },
    ],
  },
  {
    deck: 'conditional-probability-and-bayes',
    topic: PS,
    cards: [
      {
        id: 'bayes-derive-from-definition',
        type: 'formula',
        front: 'Derive Bayes\' rule from the definition of conditional probability.',
        back: 'Conditional probability is defined by $P(A \\mid B) = P(A \\cap B)/P(B)$. Writing the joint two ways, $P(A \\cap B) = P(B \\mid A)P(A) = P(A \\mid B)P(B)$, and rearranging:\n\n$$P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)}$$\n\nBayes\' rule is not an extra axiom — it is the symmetry of the joint probability, read in the other direction.',
        answer: 'P(B|A)P(A)/P(B)',
        sources: [guide(PS), wiki("Bayes' theorem", 'Bayes%27_theorem')],
        tags: ['bayes', 'conditional'],
      },
      {
        id: 'bayes-denominator-role',
        type: 'why',
        front: 'In $P(A \\mid B) = P(B \\mid A)P(A)/P(B)$, what job is the denominator doing?',
        back: 'It normalises. The numerator gives the unnormalised weight of the hypothesis $A$ after seeing $B$; dividing by $P(B) = \\sum_i P(B \\mid A_i)P(A_i)$ makes the posterior probabilities over all hypotheses sum to one.\n\nTwo consequences. Comparing two hypotheses on the same evidence lets the denominator cancel, which is why the posterior *odds* form is often easier. And computing $P(B)$ is the hard part in real problems, which is what sampling methods exist to avoid.',
        sources: [guide(PS), wiki("Bayes' theorem", 'Bayes%27_theorem')],
        tags: ['bayes', 'normalisation'],
      },
      {
        id: 'law-of-total-probability',
        type: 'formula',
        front: 'State the law of total probability for a partition $\\{A_i\\}$.',
        back: '$$P(B) = \\sum_i P(B \\mid A_i)\\,P(A_i)$$\n\nValid whenever the $A_i$ are disjoint and cover the whole space. It is the conditioning move: split an intractable probability into cases you can compute inside.',
        answer: 'sum_i P(B|A_i)P(A_i)',
        sources: [guide(PS), wiki('Law of total probability', 'Law_of_total_probability')],
        tags: ['conditioning', 'partition'],
      },
      {
        id: 'base-rate-positive-test',
        type: 'why',
        front: 'A test is 99% accurate both ways and the condition affects 1 in 10,000. Why is a positive result still probably a false positive?',
        back: 'Per 10,000 people: 1 true case, detected with probability 0.99, so about 1 true positive. The other 9,999 are healthy and 1% test positive anyway, so about 100 false positives. The posterior is roughly $1/101 \\approx 1\\%$.\n\nThe general point is that the likelihood ratio multiplies the *prior odds*, and when the prior odds are tiny even a strong likelihood ratio leaves them small. Reasoning from the accuracy figure alone ignores the base rate entirely, which is the single most common probabilistic error in practice — including in backtests, where a screen with a good hit rate applied to thousands of hypotheses returns mostly noise.',
        sources: [guide(PS), wiki('Base rate fallacy', 'Base_rate_fallacy')],
        tags: ['bayes', 'base-rate', 'multiple-testing'],
      },
      {
        id: 'zero-correlation-not-independence',
        type: 'why',
        front: 'Construct a pair of variables that are uncorrelated but not independent.',
        back: 'Let $X \\sim \\mathcal{N}(0,1)$ and $Y = X^2$. Then $\\operatorname{Cov}(X, Y) = \\mathbb{E}[X^3] - \\mathbb{E}[X]\\mathbb{E}[X^2] = 0$ by symmetry, so they are uncorrelated. But $Y$ is a deterministic function of $X$ — knowing $X$ tells you $Y$ exactly.\n\nCorrelation measures *linear* dependence only. Independence means the joint factors, which is far stronger. The exception worth remembering: for a jointly Gaussian pair, zero correlation does imply independence — and "jointly" is doing real work there, since two marginally Gaussian variables need not be jointly Gaussian.',
        sources: [guide(PS), wiki('Correlation', 'Correlation')],
        tags: ['correlation', 'independence', 'counterexample'],
      },
      {
        id: 'law-of-total-expectation',
        type: 'formula',
        front: 'State the law of total expectation (tower property).',
        back: '$$\\mathbb{E}[X] = \\mathbb{E}\\left[\\mathbb{E}[X \\mid Y]\\right]$$\n\nThe inner expectation is a random variable — a function of $Y$ — and averaging it over $Y$ recovers the unconditional mean.',
        answer: 'E[E[X|Y]]',
        hint: 'Average the conditional average.',
        sources: [guide(PS), wiki('Law of total expectation', 'Law_of_total_expectation')],
        tags: ['tower', 'conditioning'],
      },
      {
        id: 'law-of-total-variance',
        type: 'formula',
        front: 'State the law of total variance.',
        back: '$$\\operatorname{Var}(X) = \\mathbb{E}\\left[\\operatorname{Var}(X \\mid Y)\\right] + \\operatorname{Var}\\left(\\mathbb{E}[X \\mid Y]\\right)$$',
        answer: 'E[Var(X|Y)] + Var(E[X|Y])',
        hint: 'Two terms: the average of the conditional variance, and the variance of the conditional average.',
        sources: [guide(PS), wiki('Law of total variance', 'Law_of_total_variance')],
        tags: ['variance', 'conditioning'],
      },
      {
        id: 'total-variance-interpret-terms',
        type: 'why',
        front: 'In the law of total variance, what does each of the two terms mean, and which one does a better forecast reduce?',
        back: '$\\mathbb{E}[\\operatorname{Var}(X \\mid Y)]$ is the variation left *within* groups once $Y$ is known — the unexplained part. $\\operatorname{Var}(\\mathbb{E}[X \\mid Y])$ is the variation *between* group means — the part $Y$ explains.\n\nA better predictor $Y$ moves variance from the first term into the second; the total is fixed. This is exactly the decomposition behind $R^2$, and behind the observation that conditioning can never increase expected variance: $\\mathbb{E}[\\operatorname{Var}(X\\mid Y)] \\le \\operatorname{Var}(X)$.',
        sources: [guide(PS), wiki('Law of total variance', 'Law_of_total_variance')],
        tags: ['variance', 'decomposition', 'r-squared'],
      },
    ],
  },
  {
    deck: 'covariance-and-correlation',
    topic: PS,
    cards: [
      {
        id: 'covariance-definition',
        type: 'formula',
        front: 'Define $\\operatorname{Cov}(X, Y)$ and give the computational form.',
        back: '$$\\operatorname{Cov}(X,Y) = \\mathbb{E}\\left[(X - \\mathbb{E}X)(Y - \\mathbb{E}Y)\\right] = \\mathbb{E}[XY] - \\mathbb{E}[X]\\mathbb{E}[Y]$$',
        answer: 'E[XY] - E[X]E[Y]',
        sources: [guide(PS), wiki('Covariance', 'Covariance')],
        tags: ['covariance'],
      },
      {
        id: 'covariance-bilinearity',
        type: 'formula',
        front: 'What is $\\operatorname{Cov}(aX + b,\\; cY + d)$?',
        back: '$$\\operatorname{Cov}(aX+b,\\, cY+d) = ac\\,\\operatorname{Cov}(X,Y)$$\n\nCovariance is bilinear and blind to shifts: adding a constant moves the mean and changes no deviation from it.',
        answer: 'ac Cov(X,Y)',
        sources: [guide(PS), wiki('Covariance', 'Covariance')],
        tags: ['covariance', 'bilinearity'],
      },
      {
        id: 'variance-of-sum',
        type: 'formula',
        front: 'Write $\\operatorname{Var}(X + Y)$ without assuming independence.',
        back: '$$\\operatorname{Var}(X+Y) = \\operatorname{Var}(X) + \\operatorname{Var}(Y) + 2\\operatorname{Cov}(X,Y)$$\n\nThe cross term is the whole content of diversification: it is what makes a portfolio less risky than its parts, and what disappears when correlations go to one in a crisis.',
        answer: 'Var(X) + Var(Y) + 2Cov(X,Y)',
        sources: [guide(PS), wiki('Variance', 'Variance')],
        tags: ['variance', 'diversification'],
      },
      {
        id: 'correlation-definition',
        type: 'formula',
        front: 'Define the correlation coefficient and state its range.',
        back: '$$\\rho_{XY} = \\frac{\\operatorname{Cov}(X,Y)}{\\sigma_X \\sigma_Y} \\in [-1, 1]$$\n\nIt is covariance made scale-free by dividing out both standard deviations, which is why it can be compared across pairs with different units.',
        answer: 'Cov(X,Y)/(sigma_X sigma_Y)',
        sources: [guide(PS), wiki('Correlation', 'Correlation')],
        tags: ['correlation'],
      },
      {
        id: 'correlation-bound-cauchy-schwarz',
        type: 'why',
        front: 'Why is $|\\rho| \\le 1$, and what does equality mean?',
        back: 'Cauchy–Schwarz applied to the centred variables: $\\left|\\mathbb{E}[\\tilde X \\tilde Y]\\right| \\le \\sqrt{\\mathbb{E}[\\tilde X^2]\\,\\mathbb{E}[\\tilde Y^2]}$, which is exactly $|\\operatorname{Cov}| \\le \\sigma_X \\sigma_Y$.\n\nEquality holds precisely when the centred variables are linearly dependent, $\\tilde Y = a\\tilde X$ almost surely. Reading covariance as an inner product on the space of centred random variables makes this immediate — correlation is then the cosine of the angle between them, and $|\\cos| \\le 1$.',
        sources: [guide(PS), wiki('Cauchy–Schwarz inequality', 'Cauchy%E2%80%93Schwarz_inequality')],
        tags: ['correlation', 'cauchy-schwarz', 'geometry'],
      },
      {
        id: 'correlation-not-transitive',
        type: 'why',
        front: 'If $X$ correlates with $Y$ at 0.7 and $Y$ with $Z$ at 0.7, what can you say about $\\rho_{XZ}$?',
        back: 'Only that it lies in roughly $[-0.02, 1]$. Correlation is not transitive.\n\nThe geometric reading gives the bound directly: correlations are cosines of angles between vectors, so two angles of about $45.6°$ can compose to anything from $0°$ to $91.2°$. In general $\\rho_{XZ} \\ge \\rho_{XY}\\rho_{YZ} - \\sqrt{(1-\\rho_{XY}^2)(1-\\rho_{YZ}^2)}$. Only when both correlations are high enough that the bound exceeds zero is a positive relationship forced.',
        sources: [guide(PS), wiki('Correlation', 'Correlation')],
        tags: ['correlation', 'transitivity', 'geometry'],
      },
      {
        id: 'portfolio-variance-matrix-form',
        type: 'formula',
        front: 'Write the variance of a portfolio with weights $w$ and covariance matrix $\\Sigma$.',
        back: '$$\\sigma_p^2 = w^\\top \\Sigma\\, w$$\n\nA quadratic form, and positive semi-definite because a variance cannot be negative — which is also the condition any estimated $\\Sigma$ must satisfy to be usable.',
        answer: "w^T Sigma w",
        sources: [guide(PS), wiki('Modern portfolio theory', 'Modern_portfolio_theory')],
        tags: ['portfolio', 'quadratic-form'],
      },
      {
        id: 'portfolio-variance-interpret-off-diagonal',
        type: 'why',
        front: 'In $\\sigma_p^2 = w^\\top \\Sigma w$, what do the off-diagonal entries contribute, and why does diversification stop working in a crisis?',
        back: 'The diagonal contributes $\\sum_i w_i^2 \\sigma_i^2$, the standalone risk of each holding. The off-diagonals contribute $\\sum_{i \\neq j} w_i w_j \\sigma_i \\sigma_j \\rho_{ij}$ — the entire diversification effect lives there.\n\nWith $n$ equally weighted assets of equal variance, $\\sigma_p^2 = \\sigma^2\\left[\\frac{1}{n} + \\left(1 - \\frac{1}{n}\\right)\\bar\\rho\\right]$. As $n \\to \\infty$ the first term vanishes and the floor is $\\sigma^2 \\bar\\rho$: adding names cannot diversify away average correlation. In a crisis $\\bar\\rho$ rises toward one and that floor rises with it, which is why diversification fails exactly when it is needed.',
        sources: [guide(PS), wiki('Diversification (finance)', 'Diversification_(finance)')],
        tags: ['portfolio', 'diversification', 'correlation'],
      },
    ],
  },
  {
    deck: 'limit-theorems',
    topic: PS,
    cards: [
      {
        id: 'wlln-statement',
        type: 'basic',
        front: 'State the weak law of large numbers.',
        back: 'For i.i.d. $X_i$ with finite mean $\\mu$, the sample mean converges to $\\mu$ *in probability*:\n\n$$\\bar X_n \\xrightarrow{\\;p\\;} \\mu, \\qquad \\text{i.e.} \\quad P\\left(|\\bar X_n - \\mu| > \\varepsilon\\right) \\to 0 \\ \\ \\forall \\varepsilon > 0$$',
        sources: [guide(PS), wiki('Law of large numbers', 'Law_of_large_numbers')],
        tags: ['lln'],
      },
      {
        id: 'slln-vs-wlln',
        type: 'why',
        front: 'What does the strong law say that the weak law does not?',
        back: 'The weak law says that for any fixed large $n$, the sample mean is *probably* close to $\\mu$ — but it leaves open that the sequence wanders outside the band infinitely often. The strong law rules that out: $\\bar X_n \\to \\mu$ almost surely, so with probability one the sequence eventually stays close forever.\n\nThe distinction is about the behaviour of the whole path versus the marginal at each $n$, which is the same distinction as between convergence in probability and almost-sure convergence generally.',
        sources: [guide(PS), wiki('Law of large numbers', 'Law_of_large_numbers')],
        tags: ['lln', 'convergence'],
      },
      {
        id: 'clt-statement',
        type: 'formula',
        front: 'State the central limit theorem.',
        back: 'For i.i.d. $X_i$ with mean $\\mu$ and finite variance $\\sigma^2$,\n\n$$\\sqrt{n}\\,\\frac{\\bar X_n - \\mu}{\\sigma} \\xrightarrow{\\;d\\;} \\mathcal{N}(0,1)$$\n\nFinite variance is a hypothesis, not a technicality.',
        answer: 'sqrt(n)(Xbar - mu)/sigma -> N(0,1)',
        sources: [guide(PS), wiki('Central limit theorem', 'Central_limit_theorem')],
        tags: ['clt'],
      },
      {
        id: 'clt-why-sqrt-n',
        type: 'why',
        front: 'Where does the $\\sqrt{n}$ in the CLT come from?',
        back: 'Variances of independent variables add, so $\\operatorname{Var}\\left(\\sum_i X_i\\right) = n\\sigma^2$ and the standard deviation of the sum grows as $\\sigma\\sqrt{n}$. The sample mean divides by $n$, giving standard deviation $\\sigma/\\sqrt{n}$, so multiplying by $\\sqrt{n}$ is exactly the rescaling that holds the spread fixed as $n$ grows.\n\nAnything slower and the rescaled variable collapses to a point; anything faster and it diverges. $\\sqrt{n}$ is the unique scaling at which a non-degenerate limit exists — and it is the same $\\sqrt{T}$ that governs why expected return is so much harder to estimate than volatility.',
        sources: [guide(PS), wiki('Central limit theorem', 'Central_limit_theorem')],
        tags: ['clt', 'scaling', 'estimation'],
      },
      {
        id: 'clt-fails-infinite-variance',
        type: 'why',
        front: 'When does the CLT fail, and what replaces the Gaussian limit?',
        back: 'When the variance is infinite. The proof rescales by $\\sigma\\sqrt{n}$, which is meaningless if $\\sigma$ does not exist.\n\nSums of heavy-tailed variables with tail index $\\alpha < 2$ converge instead to an $\\alpha$-stable Lévy law, rescaled by $n^{1/\\alpha}$ rather than $n^{1/2}$. The Gaussian is the special case $\\alpha = 2$.\n\nThis matters for financial returns, whose measured tail index sits near 3 — variance exists, so the CLT applies, but the convergence is slow enough that Gaussian approximations remain poor at the horizons risk is actually measured over.',
        sources: [guide(PS), wiki('Stable distribution', 'Stable_distribution')],
        tags: ['clt', 'heavy-tails', 'stable'],
      },
      {
        id: 'clt-rate-berry-esseen',
        type: 'why',
        front: 'How fast does the CLT converge, and what makes it slower?',
        back: 'The Berry–Esseen theorem bounds the largest gap between the true CDF and the normal one by $C\\rho/(\\sigma^3\\sqrt{n})$, where $\\rho = \\mathbb{E}|X - \\mu|^3$. So the error falls only as $1/\\sqrt{n}$ — and the constant is proportional to the third absolute moment, so skewed or heavy-tailed summands converge far more slowly.\n\nThe practical reading is that "$n \\ge 30$" is a rule of thumb for well-behaved variables and nothing more. In the tails, where the approximation matters most for risk, convergence is slowest.',
        sources: [guide(PS), wiki('Berry–Esseen theorem', 'Berry%E2%80%93Esseen_theorem')],
        tags: ['clt', 'convergence-rate'],
      },
      {
        id: 'delta-method',
        type: 'basic',
        front: 'Give the delta method for the asymptotic variance of $g(\\bar X_n)$.',
        back: 'If $\\sqrt{n}(\\bar X_n - \\mu) \\xrightarrow{d} \\mathcal{N}(0, \\sigma^2)$ and $g$ is differentiable at $\\mu$ with $g\'(\\mu) \\neq 0$, then\n\n$$\\sqrt{n}\\left(g(\\bar X_n) - g(\\mu)\\right) \\xrightarrow{\\;d\\;} \\mathcal{N}\\left(0,\\; \\left[g\'(\\mu)\\right]^2 \\sigma^2\\right)$$\n\nIt is a first-order Taylor expansion with the remainder shown to be negligible — which is also its limitation: it fails exactly where $g\'(\\mu) = 0$, and there the next order governs.',
        sources: [guide(PS), wiki('Delta method', 'Delta_method')],
        tags: ['delta-method', 'asymptotics'],
      },
    ],
  },
  {
    deck: 'markov-chains',
    topic: PS,
    cards: [
      {
        id: 'markov-property',
        type: 'basic',
        front: 'State the Markov property for a discrete-time chain.',
        back: '$$P\\left(X_{n+1} = j \\mid X_n = i,\\, X_{n-1}, \\dots, X_0\\right) = P\\left(X_{n+1} = j \\mid X_n = i\\right)$$\n\nThe present state screens off the past: given where you are, how you got there carries no further information about where you go next.',
        sources: [guide(PS), wiki('Markov chain', 'Markov_chain')],
        tags: ['markov', 'memorylessness'],
      },
      {
        id: 'transition-matrix-row-sums',
        type: 'why',
        front: 'Why must each row of a transition matrix sum to one, and what would a column summing to one mean?',
        back: 'Row $i$ holds the distribution of the next state given that you are currently in state $i$. It is a probability distribution over a complete set of possibilities, so it sums to one. Nothing constrains the columns.\n\nA matrix whose columns also sum to one is *doubly stochastic*, and it is a real special case rather than a convention: it implies the uniform distribution is stationary.',
        sources: [guide(PS), wiki('Stochastic matrix', 'Stochastic_matrix')],
        tags: ['markov', 'transition-matrix'],
      },
      {
        id: 'n-step-transition',
        type: 'formula',
        front: 'How do you get the $n$-step transition probabilities from the one-step matrix $P$?',
        back: '$$P^{(n)} = P^n$$\n\nMatrix multiplication *is* the Chapman–Kolmogorov equation: $P^{(n)}_{ij} = \\sum_k P^{(m)}_{ik} P^{(n-m)}_{kj}$ sums over every way of being at some intermediate state $k$ at time $m$.',
        answer: 'P^n',
        sources: [guide(PS), wiki('Chapman–Kolmogorov equation', 'Chapman%E2%80%93Kolmogorov_equation')],
        tags: ['markov', 'chapman-kolmogorov'],
      },
      {
        id: 'stationary-distribution-definition',
        type: 'formula',
        front: 'Define the stationary distribution of a chain with transition matrix $P$.',
        back: 'A probability vector $\\pi$ with\n\n$$\\pi P = \\pi, \\qquad \\sum_i \\pi_i = 1, \\qquad \\pi_i \\ge 0$$\n\nIt is a left eigenvector of $P$ with eigenvalue 1, normalised to sum to one. Note the multiplication is on the left: $\\pi$ is a row vector of probabilities being pushed through the chain.',
        answer: 'pi P = pi',
        hint: 'A distribution the chain leaves unchanged.',
        sources: [guide(PS), wiki('Markov chain', 'Markov_chain')],
        tags: ['markov', 'stationary'],
      },
      {
        id: 'stationary-uniqueness-conditions',
        type: 'why',
        front: 'When is the stationary distribution unique, and when does the chain actually converge to it?',
        back: 'Uniqueness needs **irreducibility** — every state reachable from every other — plus positive recurrence, which is automatic on a finite state space. Two disconnected components give two stationary distributions and any mixture of them.\n\nConvergence from an arbitrary start needs **aperiodicity** as well. A chain alternating deterministically between two states has a unique stationary distribution $(1/2, 1/2)$ and never converges to it: it oscillates forever. Aperiodicity is what rules that out.',
        sources: [guide(PS), wiki('Markov chain', 'Markov_chain')],
        tags: ['markov', 'irreducible', 'aperiodic'],
      },
      {
        id: 'first-step-analysis-hitting-time',
        type: 'formula',
        front: 'Write the first-step equations for the expected hitting time $h_i$ of a target set $A$.',
        back: '$$h_i = 0 \\ \\ \\text{for } i \\in A, \\qquad h_i = 1 + \\sum_j P_{ij}\\, h_j \\ \\ \\text{for } i \\notin A$$\n\nCondition on the first move: one step is always taken, then you face the expected time from wherever you landed. The $1$ counts that step and the sum is the law of total expectation applied to the next state.',
        answer: 'h_i = 1 + sum_j P_ij h_j',
        sources: [guide(PS), wiki('Hitting time', 'Hitting_time')],
        tags: ['markov', 'first-step', 'hitting-time'],
      },
      {
        id: 'gamblers-ruin-setup',
        type: 'why',
        front: 'Set up first-step analysis for gambler\'s ruin: fortune $i$, target $N$, win probability $p$. What is the ruin probability?',
        back: 'Let $r_i$ be the probability of reaching $0$ before $N$. Conditioning on the first bet:\n\n$$r_i = p\\,r_{i+1} + q\\,r_{i-1}, \\qquad r_0 = 1,\\ r_N = 0$$\n\nA linear recurrence with characteristic roots $1$ and $q/p$. For $p \\neq q$ the solution is\n\n$$r_i = \\frac{(q/p)^i - (q/p)^N}{1 - (q/p)^N}$$\n\nand for the fair case $p = q = 1/2$ it degenerates to $r_i = 1 - i/N$.\n\nThe lesson that transfers: with $p < q$ the ruin probability approaches one as $N$ grows, so a negative-edge bettor playing indefinitely is ruined with certainty regardless of starting capital — which is the discrete ancestor of the risk-of-ruin arguments behind position sizing.',
        sources: [guide(PS), wiki("Gambler's ruin", 'Gambler%27s_ruin')],
        tags: ['markov', 'first-step', 'ruin'],
      },
    ],
  },
];

fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const deck of decks) {
  fs.writeFileSync(path.join(OUT, `${deck.deck}.json`), JSON.stringify(deck, null, 2) + '\n', 'utf8');
  total += deck.cards.length;
  console.log(`${deck.deck}: ${deck.cards.length} cards`);
}
console.log(`\n${total} cards across ${decks.length} decks`);
