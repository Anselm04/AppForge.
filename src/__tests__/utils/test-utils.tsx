import {
  render,
  RenderOptions,
  RenderResult,
  screen,
  waitFor,
} from "@testing-library/react";
import { ReactElement, ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "../../i18n/LocaleContext";

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  wrapper?: React.ComponentType<{ children: ReactNode }>;
}

export function renderWithProviders(
  ui: ReactElement,
  { wrapper, ...renderOptions }: CustomRenderOptions = {},
): RenderResult {
  const Wrapper = wrapper ?? Providers;
  function WrapperComponent({ children }: { children: ReactNode }) {
    return <Wrapper>{children}</Wrapper>;
  }
  return render(ui, { wrapper: WrapperComponent, ...renderOptions });
}

export * from "@testing-library/react";

export function getByTestId(container: HTMLElement, testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`);
}

export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: "test-user-id",
    email: "test@example.com",
    username: "testuser",
    name: "Test User",
    status: "active",
    ...overrides,
  };
}

export function createMockAgent(overrides: Partial<any> = {}) {
  return {
    id: "test-agent-id",
    name: "Test Agent",
    description: "Test agent description",
    type: "workflow",
    config: {},
    metadata: {},
    ...overrides,
  };
}

export function createMockProject(overrides: Partial<any> = {}) {
  return {
    id: "test-project-id",
    name: "Test Project",
    description: "Test project description",
    repository: "https://github.com/test/test",
    framework: "react",
    metadata: {},
    ...overrides,
  };
}

export function createMockTask(overrides: Partial<any> = {}) {
  return {
    id: "test-task-id",
    projectId: "test-project-id",
    agentId: "test-agent-id",
    name: "Test Task",
    description: "Test task description",
    priority: "medium",
    status: "pending",
    input: {},
    ...overrides,
  };
}

export function createSuccessResponse(data: any) {
  return { success: true, data };
}

export function createErrorResponse(message: string, errors?: any[]) {
  return { success: false, error: "ERROR", message, errors };
}
