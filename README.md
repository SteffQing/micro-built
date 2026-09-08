# MicroBuilt 📊

MicroBuilt is a robust loan management platform designed to help financial institutions manage customers, disbursements, repayments, and inventory with clarity and precision.

> ⚙️ Built with: [NestJS](https://nestjs.com) | PostgreSQL | Prisma ORM | REST API | Swagger Docs  
> 🛠 Inspired by real-world microfinance use cases

---

## 🔍 Overview

MicroBuilt offers end-to-end tooling for managing:

- ✅ Loan applications, approvals, disbursements, and repayments
- 📈 Analytics on repayment success rate, gross profit, and net margin
- 🧾 Customer profiles and loan history
- 🧮 Vendor/Inventory tracking
- 📉 Alerts for low stock levels and repayment issues

---

## 🧱 Tech Stack

| Layer             | Tech                      |
| ----------------- | ------------------------- |
| Backend Framework | NestJS                    |
| Database          | PostgreSQL                |
| ORM               | Prisma                    |
| Auth              | JWT (coming soon)         |
| API Docs          | Swagger (Auto-gen)        |
| Deployment        | Railway / Render / Fly.io |

---

## 🚧 Features

- [x] Customer loan profile management
- [x] Loan application, approval, rejection
- [x] Repayment tracking (on-time, partial, missed)
- [x] Disbursement insights and dashboard analytics
- [ ] Authentication & roles (Admin / Agent)
- [ ] Webhooks & Notifications
- [ ] Inventory reorder alerts

---

## 🔐 Authentication

> Coming soon: Role-based access using NestJS Guards and JWT strategy

---

## 🛠 Getting Started

Clone the repo:

```bash
git clone https://github.com/steffqing/micro-built.git
cd micro-built
```

Install dependencies:

```bash
pnpm install  # or yarn / npm
```

Set up your environment:

```bash
cp .env.example .env
```

Start development server:

```bash
pnpm start:dev
```

---

## 🧪 Test

```bash
pnpm test
```

---

## 🗃 Database

MicroBuilt uses PostgreSQL with Prisma ORM.

To push schema:

```bash
pnpm prisma migrate dev
```

To seed data:

```bash
pnpm prisma db seed
```

Production deployments run `npx prisma migrate deploy` through the
`preDeployCommand` in `railway.json`. This applies committed migrations before
the new API starts, so it cannot query variation columns that are still missing
from the database. For a manual production release, run the same command using
that deployment's `DATABASE_URL`; do not use `migrate dev` or reset commands.

---

## 🔎 API Docs

Swagger docs available at:

```
http://localhost:3000/api
```

---

## 🧑‍💻 Contributing

Pull requests welcome! Please open an issue first to discuss your proposal.

## 💬 Contact

Follow my dev journey:
Twitter → [@steffqing](https://twitter.com/steffqing)

```

```
