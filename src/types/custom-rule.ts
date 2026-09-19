export type MainCategory = 'major' | 'course' | 'current_course' | 'cert' | 'attendance' | 'status' | 'rank';

export interface ConditionItem {
  id: string;
  mainCategory: MainCategory;
  subType: string;
  value: string;
}

export interface CustomRule {
  operator: 'AND' | 'OR';
  conditions: ConditionItem[];
  presetName?: string;
}

export interface PresetItem {
  id: string;
  name: string;
  rule: CustomRule;
}
