1. Hosted Payment Checkout vs TTP POST - Page Redirect
    There is exactly no difference, both are different names for same workflow.
For testing
1. You must use accounts provided at https://sandbox.jazzcash.com.pk/Sandbox/Home/GettingStarted
2. For testing different scenerios, you must use amounts listed in following document at page 93 https://payments.jazzcash.com.pk/SandboxDocumentation/Content/documentation/Payment%20Gateway%20Integration%20Guide%20for%20Merchants-v4.2.pdf
3. Marchant ID must be prefixed with Test for testing environment
4. test transactions are fully recorded, Merchants can test PG’s Payment Status Inquiry 
service
5. Payment Status Inquiry
6. Payment Status Update 
7. Delivery Status Update (you can update whether product is delivered or not)
8. Input details: (AN stands for alphanumeric, while A or N can be used seperately)
    pp_Version (1.1, 1.2, 2.0)
    [pp_TxnType] (DD - internet banking, MWALLET mobile wallet, MIGS - master card, OCT - over the counter, PAY - debit card)
    pp_Language (must be EN)
    pp_MerchantID, [pp_SubMerchantID], pp_Password, [pp_BankID] (only for DD and if known)
    [pp_ProductID] (only for DD, should be one of 'RETL','CORP')
    pp_TxnRefNo (20 chars, unique, alphanumeric)
    pp_Amount (must be in paise - multiply rupees by 100)
    pp_TxnCurrency (must be PKR)
    pp_TxnDateTime (format must be yyyyMMddHHmmss)
    pp_BillReference (alphanumeric, 20 chars max )
    pp_Description (free text, 200 chars max)
    [pp_TxnExpiryDateTime] (indicate that transaction must be approved by this time, default is 3M)
    pp_ReturnURL (200 AN)
    pp_SecureHash (64 AN) (rules are given on page 87 of the guide)
    

