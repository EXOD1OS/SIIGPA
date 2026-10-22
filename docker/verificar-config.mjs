const faltantes = ['DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET'].filter((clave) => !process.env[clave]?.trim());
if (faltantes.length) {
  console.error(`Falta configurar ${faltantes.join(', ')}. Prepará .env.docker y usá --env-file .env.docker al iniciar Compose.`);
  process.exit(1);
}
if (process.env.NEXTAUTH_SECRET.length < 32 || process.env.NEXTAUTH_SECRET === 'change-me-to-a-random-string') {
  console.error('NEXTAUTH_SECRET debe ser una clave propia de al menos 32 caracteres. Ejecutá la preparación o completá tu archivo privado.');
  process.exit(1);
}
try {
  const url = new URL(process.env.NEXTAUTH_URL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
} catch {
  console.error('NEXTAUTH_URL debe ser la URL HTTP(S) con la que se abre la aplicación.');
  process.exit(1);
}
