const express = require('express');
const { PrismaClient } = require('@prisma/client');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
var cors = require('cors')
const bodyParser = require('body-parser');

const app = express();
const prisma = new PrismaClient();
const port = 3017;

app.use(cors())
app.use(bodyParser.json());

app.get('/generate-totp/:name', async (req, res) => {
  const { name } = req.params;
  const secret = speakeasy.generateSecret({ length: 20, name: "Journaled: " + name });
  QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
    if (err) {
      return res.status(500).send('Error generating QR code');
    }
    res.json({ qrCode: data_url, secret: secret.base32 });
  });
});

const bcrypt = require('bcrypt');

app.post('/register', async (req, res) => {
  const { name, password, token, secret } = req.body;
  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
  });

  if (!verified) {
    return res.status(400).send('Invalid token');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const encryptedSecret = encrypt(secret);
    const user = await prisma.user.create({
      data: {
        name,
        password: hashedPassword,
        TOTP: encryptedSecret,
      },
    });
    const sessionId = require('crypto').randomBytes(64).toString('hex');
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        sessionId: sessionId,
      },
    });
    res.json({ user, session });
  } catch (error) {
    console.log(error)
    res.status(500).send('Error creating user');
  }
});

app.post('/login', async (req, res) => {
  const { name, password, token } = req.body;
  const user = await prisma.user.findUnique({
    where: {
      name,
    },
  });

  if (!user) {
    return res.status(404).send('User not found');
  }

  const decryptedSecret = decrypt(user.TOTP);

  const verified = speakeasy.totp.verify({
    secret: decryptedSecret,
    encoding: 'base32',
    token: token,
  });

  if (!verified) {
    return res.status(400).send('Invalid token');
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).send('Invalid password');
  }


  const sessionId = require('crypto').randomBytes(64).toString('hex');
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      sessionId: sessionId,
    },
  });

  res.json({ message: 'Logged in successfully', session });
});

const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const algorithm = 'aes-256-ctr';

// Function to encrypt the content
function encrypt(text) {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}


function decrypt(text) {
  let textParts = text.split(':');
  let iv = Buffer.from(textParts.shift(), 'hex');
  let encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  let decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

app.get('/entries/', async (req, res) => {
  const sessionId = req.headers.authorization.split(' ')[1];
  try {
    const session = await prisma.session.findFirst({
      where: {
        sessionId,
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      return res.status(404).send('Session not found');
    }

    const entries = await prisma.entries.findMany({
      where: {
        userId: session.userId,
      },
    });

    const decryptedEntries = entries.map(entry => {
      return {
        ...entry,
        content: decrypt(entry.content),
      };
    });

    res.json(decryptedEntries);
  } catch (error) {
    res.status(500).send('Error retrieving entries');
  }
});

app.post('/create-entry', async (req, res) => {
  const { content, sessionId } = req.body;
  if (!sessionId || !content) {
    return res.status(400).send('Session ID and content are required');
  }
  try {
    const session = await prisma.session.findFirst({
      where: {
        sessionId: sessionId,
      },
    });

    if (!session) {
      return res.status(404).send('Session not found');
    }

    const encryptedContent = encrypt(content);

    const entry = await prisma.entries.create({
      data: {
        userId: session.userId,
        content: encryptedContent,
      },
    });

    res.json({ message: 'Entry created successfully', entry: { ...entry, content } });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error creating entry');
  }
});

app.post('/verify-session', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).send('Session ID is required');
  }
  try {
    const session = await prisma.session.findFirst({
      where: {
        sessionId: sessionId,
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      return res.status(404).send('Session not found');
    }
    res.status(200).send('Token is valid');
  } catch (error) {
    console.error(error)
    res.status(500).send('Error verifying token');
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/ui', (req, res) => {
  res.sendFile(__dirname + '/ui.html');
});

app.use('/humanModel', express.static('humanModel'));
app.use('/assets', express.static('assets'));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
