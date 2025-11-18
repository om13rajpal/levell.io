"use client";

import React, { useState, useEffect } from "react";
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

interface SignupFormProps extends React.ComponentProps<typeof Card> {
  fullname?: string;
  email?: string;
  onChange?: (data: { fullname: string; email: string }) => void; // ✅ Live change callback
  error?: string;
}

export function SignupForm({
  fullname = "",
  email = "",
  onChange,
  error,
  ...props
}: SignupFormProps) {
  const [formData, setFormData] = useState({
    fullname,
    email,
  });

  useEffect(() => {
    setFormData({ fullname, email });
  }, [fullname, email]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const updatedData = {
      ...formData,
      [id === "name" ? "fullname" : "email"]: value,
    };
    setFormData(updatedData);
    if (onChange) onChange(updatedData); // 🔄 Notify parent on every change
  };

  // Send initial values once
  useEffect(() => {
    if (onChange) onChange(formData);
  }, []);

  return (
    <Card {...props} className="bg-transparent border-none shadow-none">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6">
          <FieldGroup>
            {/* Full Name */}
            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                required
                value={formData.fullname}
                onChange={handleChange}
              />
            </Field>

            {/* Email */}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={formData.email}
                onChange={handleChange}
              />
              <FieldDescription>
                We&apos;ll use this to contact you. We will not share your email
                with anyone else.
              </FieldDescription>
              {error ? (
                <p className="text-sm text-red-500 mt-1" role="alert">
                  {error}
                </p>
              ) : null}
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}