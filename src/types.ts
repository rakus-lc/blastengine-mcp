export interface InsertCode {
  key: string;
  value: string;
}

export interface EmailAddressWithInsertCode {
  email: string;
  insert_code?: InsertCode[];
}

export interface ListUnsubscribe {
  mailto?: string;
  url?: string;
}

export interface Sender {
  email: string;
  name?: string;
}

export interface DeliveryDetail {
  delivery_id: number;
  from?: Sender;
  status?: string;
  reservation_time?: string | null;
  text_part?: string;
  html_part?: string;
  delivery_type?: string;
  subject?: string;
  total_count?: number;
  [key: string]: unknown;
}
