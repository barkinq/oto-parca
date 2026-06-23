import { createFileRoute } from "@tanstack/react-router";
import { AdminUsersPage } from "./kullanicilar";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminUsersPage,
});