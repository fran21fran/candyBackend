import sgMail from '@sendgrid/mail';

// Initialize SendGrid only if API key is available
let isEmailConfigured = false;
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  isEmailConfigured = true;
} else {
  console.warn("SendGrid not configured: SENDGRID_API_KEY environment variable not set. Email features will be disabled.");
}

interface SubscriptionNotificationData {
  userId: string;
  username: string;
  email: string;
  timestamp: string;
  amount: number;
  currency: string;
}

export async function sendSubscriptionNotification(data: SubscriptionNotificationData): Promise<boolean> {
  if (!isEmailConfigured) {
    console.warn("SendGrid not configured, skipping subscription notification email");
    return false;
  }

  try {
    const msg = {
      to: 'candyweb44@gmail.com',
      from: 'noreply@candyweb.com', // Use your verified sender
      subject: '🎉 Nueva Suscripción Premium - CandyWeb',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
          <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
            <h1 style="color: #ffd700; text-align: center; margin-bottom: 30px;">
              👑 Nueva Suscripción Premium
            </h1>
            
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h2 style="color: #ffd700; margin-top: 0;">Detalles del Usuario</h2>
              <p><strong>Usuario:</strong> ${data.username}</p>
              <p><strong>Email:</strong> ${data.email}</p>
              <p><strong>ID Usuario:</strong> ${data.userId}</p>
            </div>
            
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h2 style="color: #ffd700; margin-top: 0;">Detalles del Pago</h2>
              <p><strong>Monto:</strong> $${data.amount} ${data.currency}</p>
              <p><strong>Fecha y Hora:</strong> ${data.timestamp}</p>
              <p><strong>Procesado por:</strong> Mercado Pago (Alias: cami.abi)</p>
            </div>
            
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 10px;">
              <h2 style="color: #ffd700; margin-top: 0;">Funciones Desbloqueadas</h2>
              <ul style="margin: 0; padding-left: 20px;">
                <li>5 Juegos Premium (Las Compras de María, Spiderman Train, Treasure Hunt, Word Soup, Plant Care)</li>
                <li>Práctica de Habla con Reconocimiento de Voz</li>
                <li>Ejercicios de Pronunciación Avanzados</li>
                <li>Evaluación de Fluidez en 5 Idiomas</li>
                <li>Acceso Completo a Todas las Funciones</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.3);">
              <p style="color: #ccc; font-size: 14px;">
                Esta notificación fue generada automáticamente por CandyWeb
              </p>
              <p style="color: #ccc; font-size: 12px;">
                CandyWeb - Plataforma de Aprendizaje de Idiomas
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
        Nueva Suscripción Premium - CandyWeb
        
        Detalles del Usuario:
        - Usuario: ${data.username}
        - Email: ${data.email}
        - ID Usuario: ${data.userId}
        
        Detalles del Pago:
        - Monto: $${data.amount} ${data.currency}
        - Fecha: ${data.timestamp}
        - Procesado por: Mercado Pago (Alias: cami.abi)
        
        Funciones Desbloqueadas:
        - 5 Juegos Premium
        - Práctica de Habla con Reconocimiento de Voz
        - Ejercicios de Pronunciación Avanzados
        - Evaluación de Fluidez en 5 Idiomas
        - Acceso Completo a Todas las Funciones
        
        Esta notificación fue generada automáticamente por CandyWeb.
      `
    };

    await sgMail.send(msg);
    console.log(`Subscription notification sent successfully to candyweb44@gmail.com for user: ${data.username}`);
    return true;
  } catch (error) {
    console.error('Error sending subscription notification email:', error);
    return false;
  }
}

export async function sendTestEmail(): Promise<boolean> {
  if (!isEmailConfigured) {
    console.warn("SendGrid not configured, cannot send test email");
    return false;
  }

  try {
    const msg = {
      to: 'candyweb44@gmail.com',
      from: 'noreply@candyweb.com',
      subject: '🧪 Test Email - CandyWeb SendGrid Configuration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #667eea;">✅ SendGrid Configurado Correctamente</h1>
          <p>Este es un email de prueba para confirmar que la configuración de SendGrid está funcionando.</p>
          <p><strong>Fecha de prueba:</strong> ${new Date().toLocaleString('es-ES')}</p>
          <p>Las notificaciones de suscripción se enviarán automáticamente a este email.</p>
        </div>
      `,
      text: `
        SendGrid Configurado Correctamente
        
        Este es un email de prueba para confirmar que la configuración de SendGrid está funcionando.
        Fecha de prueba: ${new Date().toLocaleString('es-ES')}
        Las notificaciones de suscripción se enviarán automáticamente a este email.
      `
    };

    await sgMail.send(msg);
    console.log('Test email sent successfully to candyweb44@gmail.com');
    return true;
  } catch (error) {
    console.error('Error sending test email:', error);
    return false;
  }
}