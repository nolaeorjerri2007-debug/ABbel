import PublicFooter from '../components/PublicFooter'

function Refunds() {
  return (
    <div className="legal-page">
      <div className="legal-content">
        <h1 className="legal-title">退款政策</h1>
        <p className="legal-subtitle">Refund Policy</p>

        <section className="legal-section">
          <h2 className="legal-heading">虚拟商品与算力消耗 (Virtual Goods and Compute Consumption)</h2>
          <p className="legal-para">Abbel 提供的“算力配额”和“订阅服务”属于数字化虚拟商品。由于调用上游人工智能模型会产生即时且不可逆的计算成本，因此一旦算力被消耗，我们将不提供任何形式的退款。</p>
          <p className="legal-para legal-en">The "Compute Quotas" and "Subscriptions" provided by Abbel are digital virtual goods. Due to the immediate and irreversible compute costs associated with invoking upstream AI models, no refunds will be provided under any circumstances once the compute quotas have been consumed.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-heading">未消耗的订单 (Unconsumed Orders)</h2>
          <p className="legal-para">如果您发生重复购买或严重的账单系统错误，且购买的算力完全未使用，您可以联系我们的支付服务商 Paddle 或我们的客服团队申请处理。</p>
          <p className="legal-para legal-en">In the event of a duplicate purchase or a critical billing system error, provided the purchased quotas remain completely unused, you may contact our payment provider Paddle or our support team for a resolution.</p>
        </section>

        <PublicFooter />
      </div>
    </div>
  )
}

export default Refunds
