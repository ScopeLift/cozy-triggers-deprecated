# Cozy Triggers

## Triggers contained in this repository

- `CompoundExchangeRate`: Triggers if a Compound market's exchangeRateStored drops between consecutive blocks

## Development and Deployment

1. Install dependencies with `yarn`
2. Compile contracts with `yarn compile`
3. Run tests with `yarn test`

If tests are passing, you can deploy trigger contracts with the following steps:

1. Copy the file called `.env.example` and rename it to `.env`
2. Fill in your Infura API key and the deployer account's private key
3. To deploy, run `yarn deploy --network mainnet` (replace `mainnet` with the network you want to deploy to)
