// فایل تولیدشده — دستی ویرایش نکنید.
// بازتولید: npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" --schema public > src/lib/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value": string
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "cancel_reason": string | null,"created_at": string,"created_by": string | null,"ends_at": string,"id": string,"note": string | null,"patient_id": string | null,"requested_for_self": boolean | null,"requester_mobile": string,"requester_name": string | null,"requester_national_id": string | null,"source": string,"starts_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"note"?: string | null,"patient_id"?: string | null,"requested_for_self"?: boolean | null,"requester_mobile": string,"requester_name"?: string | null,"requester_national_id"?: string | null,"source": string,"starts_at": string,"status"?: string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"note"?: string | null,"patient_id"?: string | null,"requested_for_self"?: boolean | null,"requester_mobile"?: string,"requester_name"?: string | null,"requester_national_id"?: string | null,"source"?: string,"starts_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "appointments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"bot_links": {
                  Row: {
                    "chat_id": string,"created_at": string,"id": string,"mobile": string,"patient_id": string | null,"platform": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chat_id": string,"created_at"?: string,"id"?: string,"mobile": string,"patient_id"?: string | null,"platform": string
                  }
                  Update: {
                    "chat_id"?: string,"created_at"?: string,"id"?: string,"mobile"?: string,"patient_id"?: string | null,"platform"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_links_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"chatbot_unanswered": {
                  Row: {
                    "channel": string,"created_at": string,"id": string,"question": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"created_at"?: string,"id"?: string,"question": string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"id"?: string,"question"?: string
                  }
                  Relationships: [
                    
                  ]
                },"closures": {
                  Row: {
                    "closure_date": string,"created_at": string,"created_by": string | null,"id": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "closure_date": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"reason"?: string | null
                  }
                  Update: {
                    "closure_date"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "closures_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"faq_items": {
                  Row: {
                    "answer": string,"created_at": string,"id": string,"is_active": boolean,"keywords": (string)[],"question": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"keywords"?: (string)[],"question": string,"sort_order"?: number
                  }
                  Update: {
                    "answer"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"keywords"?: (string)[],"question"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"insurance_types": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"patients": {
                  Row: {
                    "birth_date": string | null,"created_at": string,"created_by": string | null,"full_name": string,"gender": string | null,"id": string,"insurance_type_id": string | null,"mobile": string | null,"national_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"created_at"?: string,"created_by"?: string | null,"full_name": string,"gender"?: string | null,"id"?: string,"insurance_type_id"?: string | null,"mobile"?: string | null,"national_id": string
                  }
                  Update: {
                    "birth_date"?: string | null,"created_at"?: string,"created_by"?: string | null,"full_name"?: string,"gender"?: string | null,"id"?: string,"insurance_type_id"?: string | null,"mobile"?: string | null,"national_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "patients_insurance_type_id_fkey"
      columns: ["insurance_type_id"]
isOneToOne: false
      referencedRelation: "insurance_types"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_methods": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount_toman": number,"appointment_id": string | null,"created_at": string,"id": string,"insurance_type_id": string | null,"note": string | null,"paid_at": string,"patient_id": string,"payment_method_id": string,"recorded_by": string,"reverses_payment_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_toman": number,"appointment_id"?: string | null,"created_at"?: string,"id"?: string,"insurance_type_id"?: string | null,"note"?: string | null,"paid_at": string,"patient_id": string,"payment_method_id": string,"recorded_by": string,"reverses_payment_id"?: string | null
                  }
                  Update: {
                    "amount_toman"?: number,"appointment_id"?: string | null,"created_at"?: string,"id"?: string,"insurance_type_id"?: string | null,"note"?: string | null,"paid_at"?: string,"patient_id"?: string,"payment_method_id"?: string,"recorded_by"?: string,"reverses_payment_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_insurance_type_id_fkey"
      columns: ["insurance_type_id"]
isOneToOne: false
      referencedRelation: "insurance_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "payments_reverses_payment_id_fkey"
      columns: ["reverses_payment_id"]
isOneToOne: true
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"is_active": boolean,"must_change_password": boolean,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name": string,"is_active"?: boolean,"must_change_password"?: boolean,"role": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"is_active"?: boolean,"must_change_password"?: boolean,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reminder_log": {
                  Row: {
                    "appointment_id": string,"id": string,"platform": string,"result": string,"sent_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id": string,"id"?: string,"platform": string,"result": string,"sent_at"?: string
                  }
                  Update: {
                    "appointment_id"?: string,"id"?: string,"platform"?: string,"result"?: string,"sent_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_log_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    }
                  ]
                },"site_info": {
                  Row: {
                    "key": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"value": string
                  }
                  Update: {
                    "key"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"surveys": {
                  Row: {
                    "appointment_id": string,"comment": string | null,"created_at": string,"id": string,"score": number | null,"submitted_at": string | null,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id": string,"comment"?: string | null,"created_at"?: string,"id"?: string,"score"?: number | null,"submitted_at"?: string | null,"token": string
                  }
                  Update: {
                    "appointment_id"?: string,"comment"?: string | null,"created_at"?: string,"id"?: string,"score"?: number | null,"submitted_at"?: string | null,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "surveys_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: true
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    }
                  ]
                },"working_hours": {
                  Row: {
                    "created_at": string,"end_time": string,"id": string,"is_active": boolean,"start_time": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_time": string,"id"?: string,"is_active"?: boolean,"start_time": string,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string,"id"?: string,"is_active"?: boolean,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "available_slots":
{ Args: { "day": string }; Returns: {
              "ends_at": string,"starts_at": string
            }[]
                           },
"clinic_weekday":
{ Args: { "d": string }; Returns: number
                           },
"create_survey_link":
{ Args: { "p_appointment_id": string }; Returns: string
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"done_appointments_without_survey":
{ Args: { "p_days"?: number }; Returns: {
              "appointment_id": string,"patient_name": string,"starts_at": string
            }[]
                           },
"expire_stale_requests":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"finance_report":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"get_public_info":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_survey":
{ Args: { "p_token": string }; Returns: {
              "starts_at": string
            }[]
                           },
"is_doctor":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_unanswered_question":
{ Args: { "p_channel": string,"p_question": string }; Returns: boolean
                           },
"request_appointment":
{ Args: { "p_for_self": boolean,"p_mobile": string,"p_name": string,"p_national_id": string,"p_starts_at": string }; Returns: string
                           },
"setting_int":
{ Args: { "fallback": number,"k": string }; Returns: number
                           },
"submit_survey":
{ Args: { "p_comment": string,"p_score": number,"p_token": string }; Returns: boolean
                           },
"tehran_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
