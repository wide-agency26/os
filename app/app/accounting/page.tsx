import { Workspace, Section, MasterList } from "@/components/frappe-ui/Workspace";
import { AccountingDashboard } from "./AccountingDashboard";

export default function AccountingWorkspace() {
  return (
    <Workspace>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Accounting</h2>
        <p className="text-gray-500 mt-1">Financial overview, invoices, and ledgers.</p>
      </div>

      {/* Client Component that handles Data Fetching and Date Filtering */}
      <AccountingDashboard />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 border-t border-gray-100 pt-8">
        <div>
          <h4 className="text-[13px] font-bold text-gray-900 mb-3">Accounts Receivable</h4>
          <MasterList items={[
            { label: "Sales Invoice", href: "/app/accounting/sales-invoice" },
            { label: "Payment Entry", href: "/app/accounting/payment-entry" },
            { label: "Customers", href: "/app/accounting/customer" },
          ]} />
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-gray-900 mb-3">Accounts Payable</h4>
          <MasterList items={[
            { label: "Purchase Invoice", href: "/app/accounting/purchase-invoice" },
            { label: "Expenses", href: "/app/accounting/expense" },
            { label: "Suppliers", href: "/app/accounting/supplier" },
          ]} />
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-gray-900 mb-3">General Ledger</h4>
          <MasterList items={[
            { label: "Chart of Accounts", href: "/app/accounting/chart-of-accounts" },
            { label: "Journal Entry", href: "/app/accounting/journal-entry" },
            { label: "Taxes and Charges", href: "/app/accounting/tax-template" },
          ]} />
        </div>
      </div>
    </Workspace>
  );
}
