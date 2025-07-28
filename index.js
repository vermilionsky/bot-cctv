// index.js

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys'
import P from 'pino'
import qrcode from 'qrcode-terminal'
import { Boom } from '@hapi/boom'

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

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
    const from = msg.key.remoteJid
    const sender = msg.pushName || 'Pengguna'
    const reply = (txt) => sock.sendMessage(from, { text: txt }, { quoted: msg })

    const lower = text.toLowerCase()

    // ✅ Respon Otomatis
    if (lower.includes('halo') || lower.includes('hai')) {
      reply(`👋 Halo ${sender}! Terima kasih telah menghubungi *Layanan Instalasi CCTV*.

📍 Kami melayani pemasangan & perawatan:
✅ CCTV DVR 2-8 Kamera
✅ Baby Cam, Wifi Cam
✅ Survey Lokasi & Konsultasi Gratis
✅ Area: Perumahan, Ruko, Kantor

Ketik *katalog* atau *maintenance* untuk info lainnya.
📞 Teknisi: 087869851096 (Johan)`)
    } else if (lower.includes('katalog')) {
      reply('📦 Katalog kami sedang disiapkan. Untuk info lengkap silakan hubungi teknisi: 087869851096.')
    } else if (lower.includes('maintenance')) {
      reply('🔧 Untuk permintaan perawatan CCTV, hubungi teknisi Johan di 087869851096.')
    } else {
      reply(`🤖 Maaf, saya belum mengenali pesan *"${text}"*.
Ketik *halo* untuk mulai.`)
    }
  })
}

startBot().catch((err) => console.error('❗ Bot Error:', err))
