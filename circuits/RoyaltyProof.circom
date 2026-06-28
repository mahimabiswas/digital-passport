pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";

template RoyaltyProof() {
    // Private inputs
    signal input price;

    // Public inputs
    signal input minPrice;
    signal input royaltyAmount;
    signal input basisPoints;

    // Constraint 1: price >= minPrice
    component gte = GreaterEqThan(64);
    gte.in[0] <== price;
    gte.in[1] <== minPrice;
    gte.out === 1;

    // Constraint 2: royaltyAmount == price * basisPoints / 10000
    signal computedRoyalty <== price * basisPoints;
    royaltyAmount * 10000 === computedRoyalty;
}

component main {public [minPrice, royaltyAmount, basisPoints]} = RoyaltyProof();