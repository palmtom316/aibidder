import type { FormEvent } from "react";

import type { RuntimeConnectivityResult, RuntimeSettings } from "../lib/api";

type RuntimeForm = {
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  selectedRole: keyof RuntimeSettings["default_models"];
  defaultModels: RuntimeSettings["default_models"];
};

type SettingsDrawerProps = {
  open: boolean;
  disabled: boolean;
  runtimeSettings: RuntimeSettings | null;
  runtimeForm: RuntimeForm;
  connectivityResult: RuntimeConnectivityResult | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldChange: (field: "provider" | "apiBaseUrl" | "apiKey", value: string) => void;
  onSelectedRoleChange: (value: RuntimeForm["selectedRole"]) => void;
  onModelChange: (role: keyof RuntimeSettings["default_models"], value: string) => void;
};

export function SettingsDrawer({
  open,
  disabled,
  runtimeSettings,
  runtimeForm,
  connectivityResult,
  onClose,
  onSubmit,
  onFieldChange,
  onSelectedRoleChange,
  onModelChange,
}: SettingsDrawerProps) {
  return (
    <div className={`settings-drawer-wrap ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="drawer-backdrop" onClick={onClose} type="button" />
      <aside className="settings-drawer" aria-label="运行时设置">
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h3>运行时与 BYOK</h3>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          <div className="two-column">
            <label>
              Provider
              <input
                value={runtimeForm.provider}
                onChange={(event) => onFieldChange("provider", event.target.value)}
              />
            </label>
            <label>
              API Base URL
              <input
                value={runtimeForm.apiBaseUrl}
                onChange={(event) => onFieldChange("apiBaseUrl", event.target.value)}
              />
            </label>
          </div>

          <div className="two-column">
            <label>
              API Key
              <input
                autoComplete="new-password"
                type="password"
                value={runtimeForm.apiKey}
                placeholder={runtimeSettings?.api_key_configured ? "后端已配置，可覆盖" : "输入调试用 BYOK"}
                onChange={(event) => onFieldChange("apiKey", event.target.value)}
              />
            </label>
            <label>
              连通性校验角色
              <select
                value={runtimeForm.selectedRole}
                onChange={(event) => onSelectedRoleChange(event.target.value as RuntimeForm["selectedRole"])}
              >
                {Object.keys(runtimeForm.defaultModels).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="role-grid">
            {Object.entries(runtimeForm.defaultModels).map(([role, model]) => (
              <label key={role}>
                {role}
                <input
                  value={model}
                  onChange={(event) =>
                    onModelChange(role as keyof RuntimeSettings["default_models"], event.target.value)
                  }
                />
              </label>
            ))}
          </div>

          <button className="primary-button" disabled={disabled} type="submit">
            运行模型连通性检查
          </button>

          {connectivityResult ? (
            <div className={`message-box ${connectivityResult.ok ? "message-success" : "message-warning"}`}>
              <strong>{connectivityResult.ok ? "连通成功" : "连通失败"}</strong>
              <p>
                {connectivityResult.model} · {connectivityResult.message}
              </p>
            </div>
          ) : null}
        </form>
      </aside>
    </div>
  );
}
