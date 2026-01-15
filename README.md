📘 BACKEND README

(NestJS – Stellar Insured Backend API)

Stellar Insured ⚙️ — Backend API

The Stellar Insured backend is a secure and scalable API layer that supports decentralized insurance operations such as policy management, claims processing, DAO governance, oracle verification, and analytics.

Built with NestJS, this backend serves frontend clients, DAO participants, and third-party integrations, while coordinating off-chain logic such as fraud detection and data aggregation—without compromising the trustless nature of Stellar-based smart contracts.

✨ Core Responsibilities

Insurance policy lifecycle management

Claim submission and verification

DAO proposals, voting, and result tracking

Oracle data ingestion

Fraud detection and monitoring

Analytics and reporting APIs

🧑‍💻 Tech Stack

Framework: NestJS

Language: TypeScript

Runtime: Node.js 18+

Database: PostgreSQL or MongoDB

Cache: Redis

Testing: Jest, Supertest

Deployment: Docker, Cloud providers

📦 Installation & Setup
Prerequisites

Node.js 18+

npm

PostgreSQL or MongoDB

Redis

Environment Setup
cp .env.example .env


Example environment variables:

PORT=4000
DATABASE_URL=postgres://user:password@localhost:5432/stellar_insured
REDIS_URL=redis://localhost:6379

STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

Running the Server
# Install dependencies
npm install

# Development mode
npm run start:dev

# Production mode
npm run start:prod

🧪 Testing
# Unit tests
npm run test

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:cov

🌐 API Documentation

Swagger UI: http://localhost:4000/api/docs

🤝 Contributing

Fork the repository

Create a feature branch

Add tests for new features

Open a Pull Request

📚 Resources

NestJS Docs: https://docs.nestjs.com

Stellar Docs: https://developers.stellar.org

Soroban Docs: https://soroban.stellar.org/docs

📜 License

MIT License
