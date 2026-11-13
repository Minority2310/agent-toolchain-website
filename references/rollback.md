# 回滚

线上出问题时，用 `git revert` 生成一个反向提交再推送，Cloudflare 会自动部署。**不要改写历史，不要强制推送。**

开始前先读 [ops-basics.md](ops-basics.md)。

```bash
git log --oneline -5
git revert --no-edit <出问题的提交>
vp check && vp test && vp build
git push origin main
```

推送后照 [sync-and-publish.md](sync-and-publish.md) 的第 8、9 步确认构建和线上结果。

## 注意

- 回滚数据提交只会恢复仓库里的 `toolchain.json` 和附件，**飞书里的数据没有变**，下一次同步又会把它带回来。要彻底撤销，让用户先在飞书里改回去。
- 提交里同时有代码和数据时，`git revert` 会一起撤销，需要的话改用 `git revert --no-commit` 后只保留要撤销的部分。
- 回滚同样是推送到 `main`，也算上线，遵守「用户没有要求推送时只提交」的规则。

> 这份流程是按常规 git 做法写的，没有在这个仓库里实际演练过。
