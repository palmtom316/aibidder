import { useState } from "react";

import type { RuntimeConnectivityResult, RuntimeSettings } from "../lib/api";

type RuntimeRole = keyof RuntimeSettings["default_models"];

type RuntimeRoleConfig = {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
};

type RuntimePlatformConfig = {
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
};

type RuntimeForm = {
  platformConfig: RuntimePlatformConfig;
  roleConfigs: Record<RuntimeRole, RuntimeRoleConfig>;
};

type SettingsDrawerProps = {
  open: boolean;
  disabled: boolean;
  runtimeSettings: RuntimeSettings | null;
  runtimeForm: RuntimeForm;
  connectivityResult: RuntimeConnectivityResult | null;
  connectivityRole: RuntimeRole | "platform" | null;
  checkingRole: RuntimeRole | "platform" | null;
  onClose: () => void;
  onCheckRole: (role: RuntimeRole | "platform") => void;
  onPlatformFieldChange: (field: keyof RuntimePlatformConfig, value: string) => void;
  onRoleFieldChange: (role: RuntimeRole, field: keyof RuntimeRoleConfig, value: string) => void;
};

type SettingsTabId = "platform" | "recognition" | "analysis" | "writing-review";

type SettingsTab = {
  id: SettingsTabId;
  label: string;
  roles?: RuntimeRole[];
};

const ROLE_LABELS: Record<RuntimeRole, string> = {
  ocr_role: "文件识别",
  decomposition_navigator_role: "招标分析规划",
  decomposition_extractor_role: "条款提取",
  writer_role: "标书编写",
  reviewer_role: "标书审核",
  adjudicator_role: "结果复核",
};

const SETTINGS_TABS: SettingsTab[] = [
  { id: "platform", label: "AI 平台" },
  { id: "recognition", label: "识别", roles: ["ocr_role", "decomposition_extractor_role"] },
  { id: "analysis", label: "分析", roles: ["decomposition_navigator_role", "adjudicator_role"] },
  { id: "writing-review", label: "写作/审核", roles: ["writer_role", "reviewer_role"] },
];

function getRoleLabel(role: RuntimeRole) {
  return ROLE_LABELS[role] ?? role;
}

export function SettingsDrawer({
  open,
  disabled,
  runtimeSettings,
  runtimeForm,
  connectivityResult,
  connectivityRole,
  checkingRole,
  onClose,
  onCheckRole,
  onPlatformFieldChange,
  onRoleFieldChange,
}: SettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("platform");
  const activeTabConfig = SETTINGS_TABS.find((tab) => tab.id === activeTab) ?? SETTINGS_TABS[0];
  const platformReady = Boolean(
    runtimeForm.platformConfig.provider.trim() &&
      runtimeForm.platformConfig.apiBaseUrl.trim() &&
      runtimeForm.platformConfig.apiKey.trim(),
  );

  return (
    <div className={`settings-drawer-wrap ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="drawer-backdrop" onClick={onClose} type="button" />
      <aside className="settings-drawer settings-drawer-chatgpt settings-drawer-compact" aria-label="模型设置">
        <div className="drawer-header settings-header-minimal">
          <h3>模型设置</h3>
          <button className="ghost-button settings-close-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="模型设置分组">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              aria-selected={tab.id === activeTab}
              className={`settings-tab ${tab.id === activeTab ? "settings-tab-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "platform" ? (
          <section className="settings-role-card settings-platform-card">
            <div className="settings-role-card-header">
              <strong>AI 平台</strong>
              {connectivityRole === "platform" && connectivityResult ? (
                <span
                  className={`settings-inline-status ${connectivityResult.ok ? "settings-inline-status-ok" : "settings-inline-status-fail"}`}
                >
                  {connectivityResult.ok ? "可用" : "失败"}
                </span>
              ) : null}
            </div>

            <div className="settings-platform-grid">
              <label>
                平台
                <input
                  autoComplete="off"
                  className="settings-chat-input"
                  value={runtimeForm.platformConfig.provider}
                  onChange={(event) => onPlatformFieldChange("provider", event.target.value)}
                />
              </label>
              <label>
                Base URL
                <input
                  autoComplete="url"
                  className="settings-chat-input"
                  value={runtimeForm.platformConfig.apiBaseUrl}
                  onChange={(event) => onPlatformFieldChange("apiBaseUrl", event.target.value)}
                />
              </label>
              <label className="settings-platform-key-field">
                API Key
                <input
                  autoComplete="new-password"
                  className="settings-chat-input"
                  type="password"
                  placeholder={runtimeSettings?.api_key_configured ? "输入 API Key" : "输入 API Key"}
                  value={runtimeForm.platformConfig.apiKey}
                  onChange={(event) => onPlatformFieldChange("apiKey", event.target.value)}
                />
              </label>
            </div>

            <div className="settings-role-actions">
              <button
                className="primary-button settings-chat-button"
                disabled={
                  disabled ||
                  checkingRole === "platform" ||
                  !runtimeForm.platformConfig.provider.trim() ||
                  !runtimeForm.platformConfig.apiBaseUrl.trim() ||
                  !runtimeForm.platformConfig.apiKey.trim()
                }
                onClick={() => onCheckRole("platform")}
                type="button"
              >
                {checkingRole === "platform" ? "检查中..." : "检查"}
              </button>
            </div>
          </section>
        ) : (
          <div className="settings-role-stack settings-role-stack-compact">
            {(activeTabConfig.roles ?? []).map((role) => {
              const roleConfig = runtimeForm.roleConfigs[role];
              const isChecking = checkingRole === role;
              const showResult = connectivityRole === role && connectivityResult;

              return (
                <section key={role} className="settings-role-card settings-role-card-inline">
                  <div className="settings-role-card-header settings-role-card-header-inline">
                    <strong>{getRoleLabel(role)}</strong>
                    {platformReady ? <span className="settings-inline-chip">AI 平台</span> : null}
                    {showResult ? (
                      <span
                        className={`settings-inline-status ${connectivityResult.ok ? "settings-inline-status-ok" : "settings-inline-status-fail"}`}
                      >
                        {connectivityResult.ok ? "可用" : "失败"}
                      </span>
                    ) : null}
                  </div>

                  <div className="settings-role-inline-body settings-role-inline-body-advanced">
                    <label className="settings-role-inline-field settings-role-inline-model-field">
                      模型名称
                      <input
                        autoComplete="off"
                        className="settings-chat-input"
                        title={roleConfig.model}
                        value={roleConfig.model}
                        onChange={(event) => onRoleFieldChange(role, "model", event.target.value)}
                      />
                    </label>
                    <label className="settings-role-inline-field">
                      API Key
                      <input
                        autoComplete="new-password"
                        className="settings-chat-input"
                        type="password"
                        value={roleConfig.apiKey}
                        onChange={(event) => onRoleFieldChange(role, "apiKey", event.target.value)}
                      />
                    </label>
                    <label className="settings-role-inline-field">
                      Base URL
                      <input
                        autoComplete="url"
                        className="settings-chat-input"
                        value={roleConfig.apiBaseUrl}
                        onChange={(event) => onRoleFieldChange(role, "apiBaseUrl", event.target.value)}
                      />
                    </label>
                    <button
                      className="primary-button settings-chat-button"
                      disabled={
                        disabled ||
                        isChecking ||
                        !roleConfig.model.trim() ||
                        !(runtimeForm.platformConfig.apiKey.trim() || roleConfig.apiKey.trim()) ||
                        !(runtimeForm.platformConfig.apiBaseUrl.trim() || roleConfig.apiBaseUrl.trim())
                      }
                      onClick={() => onCheckRole(role)}
                      type="button"
                    >
                      {isChecking ? "检查中..." : "检查"}
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
