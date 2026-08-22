import PublicFooter from '../components/PublicFooter'

function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-content">
        <h1 className="legal-title">隐私政策</h1>
        <p className="legal-subtitle">Privacy Policy</p>

        <section className="legal-section">
          <h2 className="legal-heading">核心数据收集 (Data Collection)</h2>
          <p className="legal-para">我们仅收集您用于登录的邮箱账号，以及您在工作台输入的提示词（Prompts）以用于 AI 生成。</p>
          <p className="legal-para legal-en">We only collect your email address for login purposes, and the prompts you enter in the workspace to facilitate AI generation.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-heading">支付信息安全 (Payment Information Security)</h2>
          <p className="legal-para">所有的支付交易均由我们的安全支付网关 Paddle.com 直接处理。Abbel 不会收集、保存或接触到您的任何信用卡或其他敏感财务信息。</p>
          <p className="legal-para legal-en">All payment transactions are processed securely and directly by our payment gateway, Paddle.com. Abbel does not collect, store, or have access to your credit card or other sensitive financial information.</p>
        </section>

        <PublicFooter />
      </div>
    </div>
  )
}

export default Privacy
