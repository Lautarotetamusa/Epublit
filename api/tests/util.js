import chai from 'chai';

export function expect_err_code(code, res){
    if(code != res.status)
        console.error(res.body);

    chai.expect(res.status).to.equal(code);
    chai.expect(res.body.success).to.be.false;
    chai.expect(res.body.error).to.exist;
}
export function expect_success_code(code, res){
    if (code != res.status)
        console.error(res.body);

    chai.expect(res.status).to.equal(code);
    chai.expect(res.body.success).to.be.true;
    chai.expect(res.body.error).to.not.exist;
}