---
term: "Maker-taker pricing"
aliases: ["maker-taker", "rebate", "taker fee"]
track: 2
status: written
---

A fee schedule that pays a rebate to orders that rest in the book and charges a fee to orders that consume it, intended to subsidise liquidity provision. It distorts what the displayed price means, since the effective price differs from the quoted one by the fee, and it creates a conflict for brokers routing on behalf of clients — the venue that is cheapest for the broker need not be best for the customer, which is precisely what best-execution rules exist to police.
