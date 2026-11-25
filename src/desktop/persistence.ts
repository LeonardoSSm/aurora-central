/** Reserved boundary for a future versioned, validated preferences store. */
export interface PreferencesStore<Preferences> {
  read(): Promise<Preferences>
  write(preferences: Preferences): Promise<void>
}
