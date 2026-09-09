function requiredValue(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function getMetaWhatsAppConfig() {
  return {
    phoneNumberId: requiredValue('WHATSAPP_PHONE_NUMBER_ID'),
    accessToken: requiredValue('META_WHATSAPP_ACCESS_TOKEN'),
  };
}
