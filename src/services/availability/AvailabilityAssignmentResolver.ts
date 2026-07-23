import type { ProjectSettings } from '../../models/project/ProjectDocument';
import type { ResourceInstance } from '../../models/resources/ResourceInstance';
import type { StandardWorkOperator } from '../../models/standardWork/StandardWorkOperator';
import type { AvailabilityStore } from './AvailabilityStore';

export interface EffectiveAvailabilityCalendar {
  readonly calendarId: string | null;
  readonly source: 'explicit' | 'projectDefault' | 'none';
  readonly valid: boolean;
  readonly active: boolean | null;
}

export class AvailabilityAssignmentResolver {
  public constructor(private readonly store: AvailabilityStore, private readonly settings: () => ProjectSettings) {}
  public forOperator(value: StandardWorkOperator): EffectiveAvailabilityCalendar { return this.resolve(value.availabilityCalendarId); }
  public forResource(value: ResourceInstance): EffectiveAvailabilityCalendar { return this.resolve(value.availabilityCalendarId); }
  public resolve(explicitId: string | null): EffectiveAvailabilityCalendar {
    const calendarId = explicitId ?? this.settings().defaultAvailabilityCalendarId;
    const calendar = calendarId ? this.store.getCalendar(calendarId) : undefined;
    return {
      calendarId,
      source: explicitId ? 'explicit' : calendarId ? 'projectDefault' : 'none',
      valid: calendarId ? Boolean(calendar) : true,
      active: calendar?.active ?? null,
    };
  }
}
