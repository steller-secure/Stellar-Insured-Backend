import { registerAs } from '@nestjs/config';

export interface NotificationConfig {
  sendgrid: {
    apiKey: string;
    fromEmail: string;
  };
  vapid: {
    publicKey: string;
    privateKey: string;
    subjectEmail: string;
  };
}

export default registerAs(
  'notification',
  (): NotificationConfig => ({
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@novafund.xyz',
    },
    vapid: {
      publicKey: process.env.VAPID_PUBLIC_KEY || '',
      privateKey: process.env.VAPID_PRIVATE_KEY || '',
      subjectEmail: process.env.VAPID_SUBJECT_EMAIL || 'admin@novafund.xyz',
    },
  }),
);
