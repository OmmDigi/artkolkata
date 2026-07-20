import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/utils/api";
import { toast } from "react-toastify";
import { Eye, EyeClosed, LoaderCircle } from "lucide-react";
import type { AxiosError } from "axios";
import type { IError, IResponse } from "@/types";
import { useDoMutation } from "@/hooks/useDoMutation";
import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";

const doLogin = async (body: {
  email: string | undefined;
  password: string | undefined;
}) => {
  return await api.post("/api/v1/users/login", body);
};

interface IProps extends React.ComponentProps<"div"> {
  formType?: "login" | "forgot-password" | "change-password";
}

export function LoginForm({ className, formType = "login", ...props }: IProps) {
  const [searchParams] = useSearchParams();
  const { isPending, mutate } = useMutation({
    mutationFn: doLogin,
    onSuccess: (data) => {
      const successData = data.data as IResponse<{ refreshToken: string, permissions : Record<string, string> | null }>;
      localStorage.setItem("token", successData.data.refreshToken);
      localStorage.setItem("permissions", JSON.stringify(successData.data.permissions ?? {}));
      toast.success("Login Successfull");
      window.location.href = "/";
    },
    onError: (error: AxiosError<IError>) => {
      toast.error(error.response?.data.message ?? "Unable to login");
    },
  });

  const { isLoading: isMutating, mutate: doMutate } = useDoMutation();
  const [passwordType, setPasswordType] = useState("password");

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    let payload: any = {};

    if (formType == "login") {
      payload = {
        email: data.get("email")?.toString(),
        password: data.get("password")?.toString(),
      };
      mutate(payload);
    } else if (formType === "forgot-password") {
      payload = {
        email: data.get("email")?.toString(),
      };
      doMutate({
        apiPath: "/api/v1/users/send-otp",
        method: "post",
        formData: payload,
        onSuccess() {
          window.location.href = `/change-password?email=${payload.email}`;
        },
      });
    } else if (formType === "change-password") {
      const email = searchParams.get("email");
      payload = {
        email: email,
        otp: data.get("otp")?.toString(),
        password: data.get("password")?.toString(),
      };
      doMutate({
        apiPath: "/api/v1/users/verify-otp",
        method: "post",
        formData: payload,
        onSuccess() {
          alert("Password successfully changed now login with new password");
          window.location.href = "/login";
        },
      });
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>
            {formType == "login"
              ? "Login to your account"
              : formType == "forgot-password"
                ? "Forgot Password"
                : "Change Password"}
          </CardTitle>
          <CardDescription>
            {formType == "login"
              ? "Enter your email below to login to your account"
              : formType == "forgot-password"
                ? "Enter the email address associated with your account."
                : "Enter otp and new password to change the old one"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFormSubmit}>
            <FieldGroup>
              {formType == "change-password" ? null : (
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                  />
                </Field>
              )}

              {formType == "change-password" && (
                <Field>
                  <FieldLabel htmlFor="otp">Otp</FieldLabel>
                  <Input
                    id="otp"
                    name="otp"
                    type="text"
                    placeholder="1435"
                    required
                  />
                </Field>
              )}

              {formType == "forgot-password" ? null : (
                <Field>
                  <div>
                    <FieldLabel htmlFor="password">
                      {formType === "change-password"
                        ? "New Password"
                        : "Password"}
                    </FieldLabel>
                  </div>
                  <div className="flex items-center gap-3.5">
                    <Input
                      id="password"
                      type={passwordType}
                      name="password"
                      required
                    />

                    {passwordType == "password" ? (
                      <Eye
                        onClick={() => setPasswordType("text")}
                        className="cursor-pointer"
                        strokeWidth={0.75}
                      />
                    ) : (
                      <EyeClosed
                        onClick={() => setPasswordType("password")}
                        className="cursor-pointer"
                        strokeWidth={0.75}
                      />
                    )}
                  </div>
                  {formType == "login" && (
                    <span className="text-right">
                      <Link
                        to="/forgot-password"
                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                      >
                        Forgot your password?
                      </Link>
                    </span>
                  )}
                </Field>
              )}

              <Field>
                <Button
                  disabled={isPending || isMutating}
                  type="submit"
                  className="cursor-pointer"
                >
                  {isPending || isMutating ? (
                    <LoaderCircle className="animate-spin" />
                  ) : formType == "login" ? (
                    "Login"
                  ) : formType == "forgot-password" ? (
                    "Send Otp"
                  ) : (
                    "Change Password"
                  )}
                </Button>
                {formType == "login" && (
                  <FieldDescription className="text-center">
                    Ask Your Admin For Credential
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
