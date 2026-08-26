/**
 * Generates a booking code in the format: {PKG-SLUG}-{MMDD}-{GUEST-NAME-FIRST-4}
 * Example: ISLAN-0826-JUAN
 *
 * Matches the SQL generate_booking_code() function in the migration.
 * Handles special characters by stripping non-alphanumeric characters.
 */
export function generateBookingCode(
  packageSlug: string,
  tourDate: string,
  guestName: string
): string {
  // Slug: first 5 chars, uppercase
  const slug = packageSlug.toUpperCase().slice(0, 5);

  // Date: extract MMDD from YYYY-MM-DD
  const datePart = tourDate.replace(/-/g, "").slice(-4);

  // Name: first 4 chars, uppercase, alphanumeric only
  const name = guestName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);

  return `${slug}-${datePart}-${name}`;
}
