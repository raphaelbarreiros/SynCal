declare module 'ical-expander' {
  interface IcalDate {
    toJSDate(): Date;
    readonly isDate: boolean;
  }

  interface IcalEvent {
    readonly uid?: string;
    readonly summary?: string;
    readonly startDate: IcalDate;
    readonly endDate: IcalDate;
  }

  interface IcalOccurrence {
    readonly item: IcalEvent;
    readonly startDate: IcalDate;
    readonly endDate: IcalDate;
  }

  interface IcalExpanderResult {
    readonly events: IcalEvent[];
    readonly occurrences: IcalOccurrence[];
  }

  interface IcalExpanderOptions {
    ics: string;
    maxIterations?: number;
    skipInvalidDates?: boolean;
  }

  export default class IcalExpander {
    constructor(options: IcalExpanderOptions);
    between(after?: Date, before?: Date): IcalExpanderResult;
    before(before?: Date): IcalExpanderResult;
    after(after?: Date): IcalExpanderResult;
    all(): IcalExpanderResult;
    readonly component: unknown;
  }
}
