import nodemailer from 'nodemailer';

const {
  MAIL_MAILER,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_USERNAME,
  MAIL_PASSWORD,
  MAIL_ENCRYPTION,
  MAIL_FROM_ADDRESS,
  MAIL_FROM_NAME,
} = process.env;

const buildTransporter = () => {
  if (!MAIL_HOST || !MAIL_PORT || !MAIL_USERNAME || !MAIL_PASSWORD || !MAIL_FROM_ADDRESS) {
    return null;
  }
  if (MAIL_MAILER && MAIL_MAILER !== 'smtp') {
    return null;
  }

  const port = Number(MAIL_PORT);
  const encryption = (MAIL_ENCRYPTION || '').toLowerCase();
  const secure = encryption === 'ssl' || port === 465;

  return nodemailer.createTransport({
    host: MAIL_HOST,
    port,
    secure,
    auth: {
      user: MAIL_USERNAME,
      pass: MAIL_PASSWORD,
    },
  });
};

const transporter = buildTransporter();

const formatFieldRow = (label, value) => `
  <tr>
    <td style="padding:6px 0;color:#475569;font-weight:600;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;color:#0f172a;">${value || '-'}</td>
  </tr>
`;

const buildEmailLayout = ({ heading, intro, rows, footerNote }) => `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="background:#1d4ed8;color:#ffffff;padding:20px 24px;">
        <h1 style="margin:0;font-size:20px;">${heading}</h1>
        <p style="margin:6px 0 0;font-size:14px;color:#dbeafe;">KRM Mobilindo Follow-Up System</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;color:#334155;">${intro}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div style="margin-top:24px;padding:12px 16px;background:#f1f5f9;border-radius:8px;color:#475569;font-size:13px;">
          ${footerNote}
        </div>
      </div>
    </div>
  </div>
`;

export const sendMail = async ({ to, subject, html }) => {
  if (!transporter) {
    console.warn('Email transporter belum dikonfigurasi. Email dibatalkan.');
    return;
  }

  await transporter.sendMail({
    from: `${MAIL_FROM_NAME || 'KRM Mobilindo'} <${MAIL_FROM_ADDRESS}>`,
    to,
    subject,
    html,
  });
};

export const buildProspectEmail = ({ prospect, salesProfile }) =>
  buildEmailLayout({
    heading: 'Prospek Baru Masuk',
    intro: 'Prospek baru telah ditambahkan ke sistem. Berikut detailnya:',
    rows: [
      formatFieldRow('Nama Prospek', prospect.nama),
      formatFieldRow('No. HP', prospect.no_hp),
      formatFieldRow('Alamat', prospect.alamat),
      formatFieldRow('Kebutuhan', prospect.kebutuhan),
      formatFieldRow('Sales', salesProfile?.full_name),
      formatFieldRow('Email Sales', salesProfile?.email),
      formatFieldRow('Tanggal Input', new Date(prospect.created_at).toLocaleString('id-ID')),
    ].join(''),
    footerNote:
      'Silakan login ke dashboard admin untuk menindaklanjuti prospek ini dan menjadwalkan follow-up.',
  });

export const buildFollowUpAssignedEmail = ({ followUp, prospect, assignedBy, assignedTo }) =>
  buildEmailLayout({
    heading: 'Penugasan Follow-Up Baru',
    intro: 'Anda menerima penugasan follow-up baru. Detail penugasan tersedia di bawah ini:',
    rows: [
      formatFieldRow('Nama Prospek', prospect?.nama),
      formatFieldRow('No. HP', prospect?.no_hp),
      formatFieldRow('Kebutuhan', prospect?.kebutuhan),
      formatFieldRow(
        'Jadwal Follow-Up',
        new Date(followUp.scheduled_date).toLocaleString('id-ID')
      ),
      formatFieldRow('Catatan Admin', followUp.notes || '-'),
      formatFieldRow('Ditugaskan Oleh', assignedBy?.full_name),
      formatFieldRow('Email Admin', assignedBy?.email),
      formatFieldRow('Sales Tujuan', assignedTo?.full_name),
      formatFieldRow('Email Sales', assignedTo?.email),
    ].join(''),
    footerNote:
      'Mohon pastikan follow-up dilakukan sesuai jadwal dan perbarui statusnya di aplikasi.',
  });

export const buildFollowUpCompletedEmail = ({ followUp, prospect, assignedBy, assignedTo }) =>
  buildEmailLayout({
    heading: 'Follow-Up Selesai',
    intro: 'Follow-up prospek telah diselesaikan. Berikut ringkasannya:',
    rows: [
      formatFieldRow('Nama Prospek', prospect?.nama),
      formatFieldRow('No. HP', prospect?.no_hp),
      formatFieldRow('Kebutuhan', prospect?.kebutuhan),
      formatFieldRow(
        'Jadwal Follow-Up',
        new Date(followUp.scheduled_date).toLocaleString('id-ID')
      ),
      formatFieldRow('Catatan Sales', followUp.notes || '-'),
      formatFieldRow('Diselesaikan Pada', new Date(followUp.completed_at).toLocaleString('id-ID')),
      formatFieldRow('Sales', assignedTo?.full_name),
      formatFieldRow('Email Sales', assignedTo?.email),
      formatFieldRow('Admin Penanggung Jawab', assignedBy?.full_name),
      formatFieldRow('Email Admin', assignedBy?.email),
    ].join(''),
    footerNote:
      'Silakan cek detail lengkap di dashboard admin untuk memastikan tindak lanjut berikutnya.',
  });
