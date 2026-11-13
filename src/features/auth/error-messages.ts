import type { AuthError } from "@supabase/supabase-js";

/** Maps Supabase Auth errors to user-facing Bulgarian copy without leaking account existence. */
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Грешен имейл или парола.";
    case "email_not_confirmed":
      return "Имейлът ти още не е потвърден. Провери пощата си за линка за потвърждение.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Твърде много опити. Опитай отново след няколко минути.";
    case "weak_password":
      return "Паролата е твърде слаба. Избери по-дълга и по-сложна парола.";
    case "same_password":
      return "Новата парола трябва да е различна от старата.";
    case "user_banned":
      return "Този акаунт е спрян. Свържи се с нас за повече информация.";
    case "signup_disabled":
      return "Регистрацията временно е спряна.";
    default:
      return "Възникна грешка. Опитай отново.";
  }
}
