import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys'

import P from 'pino'
import qrcode from 'qrcode-terminal'
import { Boom } from '@hapi/boom'
import fs from 'fs'

// Ambil konfigurasi dari config.json
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))

// Fungsi utama menjalankan bot
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info')

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['Bot CCTV', 'Chrome', '10.0']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = reason !== DisconnectReason.loggedOut

      console.log('🔌 Koneksi terputus.', { reason, reconnect: shouldReconnect })

      if (shouldReconnect) startBot()
      else console.log('❌ Bot logout. Scan ulang QR diperlukan.')
    } else if (connection === 'open') {
      console.log('✅ Bot CCTV Terhubung!')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
    const from = msg.key.remoteJid
    const sender = msg.pushName || 'Pengguna'
    const reply = (txt) => sock.sendMessage(from, { text: txt }, { quoted: msg })
    const lower = text.toLowerCase()

    const { greeting, catalog, maintenance } = config.keywords
    const { responses, technician } = config

    if (greeting.some(k => lower.includes(k))) {
      reply(responses.greeting
        .replace('{name}', sender)
        .replace('{techPhone}', technician.phone))
    } else if (catalog.some(k => lower.includes(k))) {
      reply(responses.katalog.replace('{techPhone}', technician.phone))
    } else if (maintenance.some(k => lower.includes(k))) {
      reply(responses.maintenance
        .replace('{techName}', technician.name)
        .replace('{techPhone}', technician.phone))
    } else {
      reply(responses.unknown.replace('{text}', text))
    }
  })
}

startBot().catch((err) => console.error('❗ Bot Error:', err))
