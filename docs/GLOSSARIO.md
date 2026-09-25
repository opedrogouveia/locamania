# Glossário — termo do negócio ↔ nome no código

> Lição do SafeKeep: renomear entidade depois custa caro (`Partner → Reseller → Partner`). O
> vocabulário é fechado aqui **antes** do schema. Na tela usa-se a coluna "Na tela"; no código, a
> coluna "No código". Mudou o termo do negócio? Muda-se o rótulo em `packages/shared/src/labels.ts`,
> não o código.

| Na tela (pt-BR) | No código | Observação |
|---|---|---|
| Cliente / locatário | `Customer` | quem aluga; entra no app com CPF |
| Moto / motocicleta | `Motorcycle` | |
| Frota | lista de `Motorcycle` | |
| Contrato / aluguel / locação | `Contract` | número `LOC-AAAA-NNNN` |
| Novo aluguel | criação de `Contract` (DRAFT) | |
| Entrega da moto | `deliver` (Contract DRAFT → ACTIVE) | gera as cobranças |
| Devolução / vistoria | `ReturnInspection` | encerra o contrato |
| Cobrança / parcela / pagamento | `Charge` | número `PAG-NNNNNN`; "pagamento" = `Charge` paga |
| Aluguel (parcela) | `Charge.kind = RENT` | |
| Caução | `Charge.kind = DEPOSIT` / `Contract.depositAmount` | não é receita; retida vira lançamento |
| Registrar pagamento / dar baixa | `registerPayment` | |
| Estorno | `reversePayment` | a cobrança volta a ficar em aberto |
| Inadimplência / em atraso | `CustomerStatus.OVERDUE`, `ChargeStatus.OVERDUE` | |
| Em cobrança | `Customer.inCollection` | encaminhado para cobrança |
| Tolerância | `payments.graceDays` | |
| Multa (por atraso) | `Charge.fineAmount` / `payments.finePercent` | ≠ multa de trânsito |
| Multa (de trânsito) | `Occurrence.type = TRAFFIC_FINE` | |
| Ocorrência | `Occurrence` | multa, acidente, avaria, furto, mecânico |
| Manutenção (serviço feito/agendado) | `MaintenanceRecord` | |
| Plano de manutenção | `MaintenancePlan` | por km, data ou os dois |
| Tipo de manutenção | `MaintenanceType` | troca de óleo, revisão… |
| Quilometragem | `Motorcycle.currentKm` + `OdometerReading` | leituras nunca sobrescritas |
| Documento / anexo / foto | `Document` | com validade opcional |
| Lançamento (receita/despesa) | `FinancialEntry` | manual; custo de manutenção vem do registro |
| Aviso da Locamania | `Announcement` | vira `Notification` para cada cliente |
| Notificação / alerta | `Notification` | uma linha por destinatário |
| Suporte / mensagem | `SupportMessage` | |
| Rastreador / bloqueio | `TrackerProvider`, `TrackerCommand` | |
| Proprietário(a) / Administrador / Financeiro / Funcionário | `StaffRole` OWNER / ADMIN / FINANCE / STAFF | |
| Histórico de alterações | `AuditLog` | |
| Parâmetros / regras | `AppParameter` | definidos em `shared/parameters.ts` |
| Catálogo (marca, modelo, tipo de documento, categoria) | `CatalogItem` | grava `code`, mostra `label` |
