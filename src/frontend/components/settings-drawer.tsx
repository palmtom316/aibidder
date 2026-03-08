import type { FormEvent } from "react";

import type { RuntimeConnectivityResult, RuntimeSettings } from "../lib/api";

import { StatusBadge } from "./ui/status-badge";

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

const ROLE_LABELS: Record<keyof RuntimeSettings["default_models"], string> = {
  ocr_role: "文件识别模型",
  decomposition_navigator_role: "招标分析规划模型",
  decomposition_extractor_role: "条款提取模型",
  writer_role: "默认写作模型",
  reviewer_role: "校核模型",
  adjudicator_role: "结果复核模型",
};

function getRoleLabel(role: keyof RuntimeSettings["default_models"]) {
  return ROLE_LABELS[role] ?? role;
}

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
      <aside className="settings-drawer" aria-label="模型与服务设置">
        <div className="drawer-header">
          <div>
            <p className="eyebrow">设置</p>
            <h3>模型与服务设置</h3>
            <p className="workspace-subtitle">确认服务地址、访问密钥和默认写作模型后，当前项目才能继续分析、编写和校核。</p>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          <section className="surface-card compact">
            <div className="stack compact">
              <strong>当前设置说明</strong>
              <p>这里主要检查模型服务是否可用，并确认默认写作模型是否符合当前投标任务需要。</p>
            </div>
          </section>

          <div className="two-column">
            <label>
              服务提供方
              <input autoComplete="off" value={runtimeForm.provider} onChange={(event) => onFieldChange("provider", event.target.value)} />
            </label>
            <label>
              服务地址
              <input autoComplete="url" value={runtimeForm.apiBaseUrl} onChange={(event) => onFieldChange("apiBaseUrl", event.target.value)} />
            </label>
          </div>

          <div className="two-column">
            <label>
              访问密钥
              <input
                autoComplete="new-password"
                type="password"
                value={runtimeForm.apiKey}
                placeholder={runtimeSettings?.api_key_configured ? "后端已配置，可按需覆盖" : "请输入可用密钥"}
                onChange={(event) => onFieldChange("apiKey", event.target.value)}
              />
            </label>
            <label>
              检查哪一项服务
              <select
                value={runtimeForm.selectedRole}
                onChange={(event) => onSelectedRoleChange(event.target.value as RuntimeForm["selectedRole"])}
              >
                {Object.keys(runtimeForm.defaultModels).map((role) => (
                  <option key={role} value={role}>
                    {getRoleLabel(role as keyof RuntimeSettings["default_models"])}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="role-grid">
            {Object.entries(runtimeForm.defaultModels).map(([role, model]) => (
              <label key={role}>
                {getRoleLabel(role as keyof RuntimeSettings["default_models"])}
                <input
                  autoComplete="off"
                  value={model}
                  onChange={(event) =>
                    onModelChange(role as keyof RuntimeSettings["default_models"], event.target.value)
                  }
                />
              </label>
            ))}
          </div>

          <button className="primary-button" disabled={disabled} type="submit">
            检查服务是否可用
          </button>

          {connectivityResult ? (
            <div className={`message-box ${connectivityResult.ok ? "message-success" : "message-warning"}`}>
              <div className="panel-header">
                <strong>{connectivityResult.ok ? "服务可用" : "服务检查未通过"}</strong>
                <StatusBadge label={connectivityResult.ok ? "可继续使用" : "请先处理"} tone={connectivityResult.ok ? "success" : "warning"} />
              </div>
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
