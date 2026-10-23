import "server-only";

export function getJitsiDomain() {
  const domain = process.env.JITSI_MEET_DOMAIN?.trim().toLowerCase();
  if (!domain || domain.length > 253
    || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    return null;
  }
  return domain;
}
