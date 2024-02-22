# Journaled

🚀 Welcome to Journaled!

## Introduction
This project is a secure authentication and journaling system using TOTP (Time-based One-Time Password) for user verification and encryption for data security.
When logged in, an AI continuously checks if a user is present. If none were detected for 30 seconds, journaled automatically logs the user out.


The UI continuously checks if the session ID is valid. If invalid, all data is destroyed and the user is redirected to the login page.

The whole application does not connect to any third-party server.

## Installation
1. Clone the repository.
2. Install NodeJS
3. Install dependencies using `npm install`.
4. Rename .env.example to .env
5. Setup any relational database compatible with prisma. I suggest using [PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql) or [myqsl](https://www.prisma.io/docs/orm/overview/databases/mysql)
6. Set up environment variables.
7. Initialize the Database using `npx prisma db push`.
8. Start the server using `npm start`.


## Credits
- Built with Express, Prisma, Speakeasy, and Crypto.
- QR Code generation using QRCode library.

Feel free to explore and contribute to this project! 🌟
