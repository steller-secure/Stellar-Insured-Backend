/**
 * Utility function to validate if a value is a valid enum member
 * @param enumType The enum object to validate against
 * @param value The value to check
 * @returns true if value is a valid enum member
 */
export function isValidEnum<T extends object>(
  enumType: T,
  value: string,
): boolean {
  return Object.values(enumType).includes(value as T[keyof T]);
}

/**
 * Get all valid enum values as an array
 * @param enumType The enum object
 * @returns Array of valid enum values
 */
export function getEnumValues<T extends object>(enumType: T): T[keyof T][] {
  return Object.values(enumType);
}

/**
 * Validate enum value and throw error if invalid
 * @param enumType The enum object
 * @param value The value to validate
 * @param fieldName Name of the field for error message
 * @throws Error if value is not a valid enum member
 */
export function validateEnum<T extends object>(
  enumType: T,
  value: string,
  fieldName: string,
): void {
  if (!isValidEnum(enumType, value)) {
    const validValues = Object.values(enumType).join(', ');
    throw new Error(
      `Invalid ${fieldName}: "${value}". Valid values are: ${validValues}`,
    );
  }
}
